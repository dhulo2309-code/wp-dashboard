<?php
/* Plugin Name: WP Dashboard Connector
   Description: Secure status + actions endpoint for your central dashboard.
   Setup: add  define('WPDASH_KEY','long-random-string');  to wp-config.php */
if (!defined('ABSPATH')) exit;

function wpdash_auth() {
  $k = defined('WPDASH_KEY') ? WPDASH_KEY : '';
  $h = $_SERVER['HTTP_X_WPDASH_KEY'] ?? '';
  return $k && hash_equals($k, $h);
}

add_action('rest_api_init', function () {
  register_rest_route('wpdash/v1', '/status', ['methods' => 'GET', 'permission_callback' => 'wpdash_auth',
    'callback' => function () {
      global $wpdb, $wp_version;
      require_once ABSPATH . 'wp-admin/includes/update.php';
      wp_update_plugins(); wp_update_themes(); wp_version_check();
      $core = get_core_updates(); $core = ($core && isset($core[0]->response) && $core[0]->response === 'upgrade') ? 1 : 0;
      $p = get_site_transient('update_plugins'); $t = get_site_transient('update_themes');
      $db = $wpdb->get_var($wpdb->prepare("SELECT SUM(data_length+index_length)/1048576 FROM information_schema.tables WHERE table_schema=%s", DB_NAME));
      $auto = $wpdb->get_var("SELECT SUM(LENGTH(option_value))/1024 FROM {$wpdb->options} WHERE autoload IN ('yes','on','auto-on','auto')");
      require_once ABSPATH . 'wp-admin/includes/plugin.php';
      $log = WP_CONTENT_DIR . '/debug.log';
      return ['wp_version' => $wp_version, 'php_version' => PHP_VERSION, 'updates_core' => $core,
        'updates_plugins' => count($p->response ?? []), 'updates_themes' => count($t->response ?? []),
        'db_size_mb' => round((float)$db, 1), 'autoload_kb' => round((float)$auto),
        'error_log_kb' => file_exists($log) ? round(filesize($log) / 1024) : 0,
        'wp_debug' => defined('WP_DEBUG') && WP_DEBUG, 'admin_user' => (bool) username_exists('admin'),
        'xmlrpc' => (bool) apply_filters('xmlrpc_enabled', true), 'inactive_plugins' => max(0, count(get_plugins()) - count((array) get_option('active_plugins', []))),
        'revisions' => (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type='revision'")];
    }]);

  register_rest_route('wpdash/v1', '/action', ['methods' => 'POST', 'permission_callback' => 'wpdash_auth',
    'callback' => function ($r) {
      global $wpdb; $a = $r->get_param('action');
      if ($a === 'clear_cache') {
        wp_cache_flush();
        if (function_exists('rocket_clean_domain')) rocket_clean_domain();
        if (function_exists('w3tc_flush_all')) w3tc_flush_all();
        if (function_exists('wp_cache_clear_cache')) wp_cache_clear_cache();
        do_action('litespeed_purge_all');
        return ['ok' => true];
      }
      if ($a === 'cleanup_db') {
        $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '\\_transient\\_%' OR option_name LIKE '\\_site\\_transient\\_%'");
        $wpdb->query("DELETE FROM {$wpdb->posts} WHERE post_type='revision'");
        $wpdb->query("DELETE FROM {$wpdb->posts} WHERE post_status='auto-draft'");
        return ['ok' => true];
      }
      return new WP_Error('bad_action', 'Unknown action', ['status' => 400]);
    }]);
});
