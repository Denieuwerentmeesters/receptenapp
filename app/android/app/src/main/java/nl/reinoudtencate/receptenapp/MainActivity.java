package nl.reinoudtencate.receptenapp;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends BridgeActivity {

    private static final Pattern LINK = Pattern.compile("https?://\\S+");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AndroidBrowserPlugin.class);
        setIntent(deelNaarSchema(getIntent()));
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        Intent omgezet = deelNaarSchema(intent);
        setIntent(omgezet);
        super.onNewIntent(omgezet);
    }

    /**
     * De deelknop van Android (Delen → Kookmaatje) stuurt de tekst mee. We maken
     * daar dezelfde kookmaatje://toevoegen?url=… van als de iOS-extension, zodat
     * de app één weg kent (src/lib/deelknop.ts, GedeeldeLink in App.tsx).
     */
    private Intent deelNaarSchema(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return intent;
        if (!"text/plain".equals(intent.getType())) return intent;
        String tekst = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (tekst == null) return intent;
        Matcher m = LINK.matcher(tekst);
        if (!m.find()) return intent;
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse("kookmaatje://toevoegen?url=" + Uri.encode(m.group())));
        return intent;
    }
}
