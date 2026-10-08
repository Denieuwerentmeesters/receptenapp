import UIKit
import UniformTypeIdentifiers

/// De deelknop van iOS: in Instagram, Safari of een andere app tik je op Delen
/// en kies je Pinch. Deze extension pakt de link uit wat er gedeeld wordt en
/// opent de app op het toevoegscherm (`pinch://toevoegen?url=…`), waar het
/// uitlezen vanzelf start (app/src/App.tsx, GedeeldeLink).
///
/// De link gaat óók in de App Group: lukt het openen van de app niet (iOS
/// staat dat een extension officieel niet toe, in de praktijk werkt het via
/// de responder chain), dan leest de app 'm bij de volgende start of als hij
/// weer actief wordt (app/src/lib/deelknop.ts). Daarom staat hier geen
/// scherm: de extension doet zijn werk en sluit meteen.
///
/// Alleen een link: screenshots deel je via Toevoegen → Kies screenshots.
class ShareViewController: UIViewController {
    private static let appGroep = "group.nl.reinoudtencate.receptenapp"
    private static let sleutel = "gedeeldeLink"

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        haalLink { [weak self] link in
            DispatchQueue.main.async {
                guard let self = self else { return }
                guard let link = link else {
                    NSLog("Pinch delen: geen link gevonden")
                    self.extensionContext?.completeRequest(returningItems: nil)
                    return
                }
                NSLog("Pinch delen: link %@", link)
                UserDefaults(suiteName: Self.appGroep)?.set(link, forKey: Self.sleutel)
                self.openApp(met: link)
                // Even wachten met afsluiten: iOS annuleert het openen als de extension al weg is.
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                    self.extensionContext?.completeRequest(returningItems: nil)
                }
            }
        }
    }

    /// De eerste http(s)-link uit de bijlagen: als URL, of als tekst met een link erin.
    private func haalLink(klaar: @escaping (String?) -> Void) {
        let bijlagen = (extensionContext?.inputItems as? [NSExtensionItem])?
            .flatMap { $0.attachments ?? [] } ?? []
        var wachtrij = bijlagen
        func volgende() {
            guard !wachtrij.isEmpty else { return klaar(nil) }
            let bijlage = wachtrij.removeFirst()
            let soort = bijlage.hasItemConformingToTypeIdentifier(UTType.url.identifier)
                ? UTType.url.identifier
                : bijlage.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) ? UTType.plainText.identifier : nil
            guard let soort = soort else { return volgende() }
            bijlage.loadItem(forTypeIdentifier: soort, options: nil) { item, _ in
                if let link = Self.linkUit(item) { klaar(link) } else { volgende() }
            }
        }
        volgende()
    }

    private static func linkUit(_ item: NSSecureCoding?) -> String? {
        let tekst: String?
        switch item {
        case let url as URL: tekst = url.absoluteString
        case let s as String: tekst = s
        case let data as Data: tekst = String(data: data, encoding: .utf8)
        default: tekst = nil
        }
        guard let t = tekst,
              let bereik = t.range(of: #"https?://[^\s<>"']+"#, options: .regularExpression) else { return nil }
        return String(t[bereik])
    }

    /// Opent de app via het URL-schema. Een extension mag UIApplication niet
    /// aanroepen; via de responder chain lukt het toch (het bekende pad dat
    /// ook andere deelknoppen gebruiken). Sinds iOS 18 doet het oude
    /// `openURL:` daar niets meer; `openURL:options:completionHandler:` wel,
    /// aangeroepen als C-functie omdat `perform` geen drie argumenten kent.
    /// Lukt het niet, dan staat de link al in de App Group.
    private func openApp(met link: String) {
        guard let gecodeerd = link.addingPercentEncoding(withAllowedCharacters: .alphanumerics),
              let url = URL(string: "pinch://toevoegen?url=\(gecodeerd)") else { return }
        if let context = extensionContext {
            context.open(url) { gelukt in
                NSLog("Pinch delen: extensionContext.open %@", gelukt ? "gelukt" : "niet gelukt")
                if !gelukt { self.openViaResponderChain(url) }
            }
        } else {
            openViaResponderChain(url)
        }
    }

    private func openViaResponderChain(_ url: URL) {
        let selector = NSSelectorFromString("openURL:options:completionHandler:")
        var responder: UIResponder? = self.next
        while let huidige = responder {
            // Alleen UIApplication zelf: een UIScene kent de selector ook, maar stuurt
            // 'm in een extension door naar iets wat 'm niet heeft, en dan crasht het.
            if huidige is UIApplication, huidige.responds(to: selector), let imp = huidige.method(for: selector) {
                typealias Open = @convention(c) (AnyObject, Selector, NSURL, NSDictionary, AnyObject?) -> Void
                let open = unsafeBitCast(imp, to: Open.self)
                open(huidige, selector, url as NSURL, [:] as NSDictionary, nil)
                NSLog("Pinch delen: geopend via %@", String(describing: type(of: huidige)))
                return
            }
            responder = huidige.next
        }
        NSLog("Pinch delen: geen responder die de app kan openen")
    }

}
