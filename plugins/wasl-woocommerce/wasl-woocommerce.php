<?php
/**
 * Plugin Name: Wasl for WooCommerce
 * Description: Lets Wasl credit orders that came from AI shopping agents. Saves the `wasl_ref` from Wasl checkout links on the order.
 * Version: 0.1.0
 * Requires Plugins: woocommerce
 * License: GPLv2 or later
 */

if (!defined('ABSPATH')) {
    exit;
}

const WASL_COOKIE = 'wasl_ref';

// 1) Remember the ref when a customer arrives from a Wasl link (kept 2 days).
add_action('init', function () {
    if (empty($_GET['wasl_ref'])) {
        return;
    }
    $ref = preg_replace('/[^A-Za-z0-9_-]/', '', wp_unslash($_GET['wasl_ref']));
    if ($ref === '' || strlen($ref) > 64) {
        return;
    }
    setcookie(WASL_COOKIE, $ref, [
        'expires'  => time() + 2 * DAY_IN_SECONDS,
        'path'     => COOKIEPATH ?: '/',
        'secure'   => is_ssl(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    $_COOKIE[WASL_COOKIE] = $ref;
});

// 2) Copy it onto the order (works for classic and block checkout). Wasl reads `_wasl_ref` from the order webhook.
add_action('woocommerce_checkout_create_order', 'wasl_attach_ref');
add_action('woocommerce_store_api_checkout_update_order_from_request', 'wasl_attach_ref');

function wasl_attach_ref($order)
{
    if (empty($_COOKIE[WASL_COOKIE]) || !is_a($order, 'WC_Order')) {
        return;
    }
    $ref = preg_replace('/[^A-Za-z0-9_-]/', '', wp_unslash($_COOKIE[WASL_COOKIE]));
    if ($ref !== '') {
        $order->update_meta_data('_wasl_ref', $ref);
    }
}
