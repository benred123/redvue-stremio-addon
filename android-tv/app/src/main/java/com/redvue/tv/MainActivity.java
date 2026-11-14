package com.redvue.tv;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * REDVUE Fire TV beta.
 *
 * First milestone: a real TV-launchable Android activity providing
 * D-pad control and Stremio handoff around the existing live REDVUE
 * interface. No TMDB credentials are stored inside this APK.
 */
public final class MainActivity extends Activity {
    private static final String HOME = "https://benred123.github.io/redvue-stremio-addon/tv/?tv=1";
    private static final String TRUSTED_HOST = "benred123.github.io";
    private static final String TRUSTED_PATH = "/redvue-stremio-addon/tv/";
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enterImmersiveMode();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(9, 9, 11));
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        webView.setWebChromeClient(new WebChromeClient());

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                return handleNavigation(request.getUrl());
            }

            @Override @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleNavigation(Uri.parse(url));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (isTrusted(Uri.parse(url))) {
                    view.evaluateJavascript("window.REDVUE_TV_REMOTE && window.REDVUE_TV_REMOTE.initialise()", null);
                    view.requestFocus();
                }
            }
        });

        setContentView(webView);
        webView.loadUrl(HOME);
    }

    private boolean isTrusted(Uri url) {
        return "https".equalsIgnoreCase(url.getScheme())
            && TRUSTED_HOST.equalsIgnoreCase(url.getHost())
            && url.getPath() != null
            && url.getPath().startsWith(TRUSTED_PATH);
    }

    private boolean handleNavigation(Uri uri) {
        if ("stremio".equalsIgnoreCase(uri.getScheme())) {
            openExternally(uri, true);
            return true;
        }
        if (isTrusted(uri)) return false;
        if ("https".equalsIgnoreCase(uri.getScheme())) {
            openExternally(uri, false);
        }
        return true; // Block unknown schemes and external navigation in the WebView.
    }

    private void openExternally(Uri uri, boolean stremio) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this,
                stremio ? "Install Stremio to open this title" : "No application can open this link",
                Toast.LENGTH_LONG).show();
        } catch (SecurityException e) {
            Toast.makeText(this, "Unable to open the requested application", Toast.LENGTH_LONG).show();
        }
    }

    private void enterImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (webView == null || event.getAction() != KeyEvent.ACTION_DOWN)
            return super.dispatchKeyEvent(event);

        // Repeat events are intentionally supported for held left/right keys.
        final String key;
        switch (event.getKeyCode()) {
            case KeyEvent.KEYCODE_DPAD_UP: key = "ArrowUp"; break;
            case KeyEvent.KEYCODE_DPAD_DOWN: key = "ArrowDown"; break;
            case KeyEvent.KEYCODE_DPAD_LEFT: key = "ArrowLeft"; break;
            case KeyEvent.KEYCODE_DPAD_RIGHT: key = "ArrowRight"; break;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER: key = "Enter"; break;
            case KeyEvent.KEYCODE_BACK:
                webView.evaluateJavascript(
                    "window.REDVUE_TV_REMOTE ? window.REDVUE_TV_REMOTE.back() : 'exit'",
                    answer -> {
                        if (answer == null || "\"exit\"".equals(answer) || "null".equals(answer))
                            finish();
                    }
                );
                return true;
            default: return super.dispatchKeyEvent(event);
        }
        webView.evaluateJavascript("window.REDVUE_TV_REMOTE && window.REDVUE_TV_REMOTE.key('" + key + "')", null);
        return true;
    }

    @Override
    protected void onResume() {
        super.onResume();
        enterImmersiveMode();
        if (webView != null) {
            webView.onResume();
            // Restore focus and close the old details card when users come
            // back from Stremio, Fire TV Home or Recent Apps.
            webView.evaluateJavascript(
                "window.REDVUE_TV_REMOTE && window.REDVUE_TV_REMOTE.resume()", null);
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            // Persist the highlighted poster before Android backgrounds us.
            webView.evaluateJavascript(
                "window.REDVUE_TV_REMOTE && window.REDVUE_TV_REMOTE.suspend()", null);
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (webView != null) {
            webView.evaluateJavascript(
                "window.REDVUE_TV_REMOTE && window.REDVUE_TV_REMOTE.resume()", null);
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
