package nl.reinoudtencate.receptenapp;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Opent een link in de standaardbrowser en nooit in de app van de winkel.
 * AH en Jumbo claimen hun links als App Link; de winkelapp opent dan wel maar
 * voegt niets toe aan het mandje (zie src/lib/ah.ts). Door het pakket van de
 * browser mee te geven slaat Android de app over.
 */
@CapacitorPlugin(name = "AndroidBrowser")
public class AndroidBrowserPlugin extends Plugin {

    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !url.matches("(?i)^https?://.*")) {
            call.reject("Geen geldige link");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        // Welke browser is de standaard? Vraag dat voor een adres dat geen app claimt.
        Intent proef = new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.example.com"));
        ResolveInfo browser = getContext().getPackageManager()
            .resolveActivity(proef, PackageManager.MATCH_DEFAULT_ONLY);
        if (browser != null && browser.activityInfo != null
            && !"android".equals(browser.activityInfo.packageName)) {
            intent.setPackage(browser.activityInfo.packageName);
        }

        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Browser openen lukte niet", e);
        }
    }
}
