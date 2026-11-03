/**
 * De mail "Nieuw wachtwoord" van Kookmaatje, in de huisstijl van de app: rood
 * kopvlak met het woordmerk, crèmekleurig blad, rode knop.
 *
 * Mailprogramma's lezen geen stylesheets en geen SVG, dus alles staat inline
 * in een tabel en het logo is een PNG (scripts/maak_maillogo.ts). Er staat
 * bewust nergens een woord van de techniek erachter: geen Neon, geen Vercel.
 */

const LOGO = 'https://kookmaatje.eu/mail/kookmaatje.png'

function esc(tekst: string): string {
  return tekst.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function wachtwoordMail(link: string, verlooptInMinuten: number): { onderwerp: string; html: string; tekst: string } {
  const onderwerp = 'Kies een nieuw wachtwoord voor Kookmaatje'
  const href = esc(link)
  const html = `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(onderwerp)}</title>
</head>
<body style="margin:0;padding:0;background:#FFF6E8;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Tik op de knop om een nieuw wachtwoord te kiezen.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF6E8;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:20px;overflow:hidden;">
<tr><td align="center" style="background:#E8202E;padding:32px 24px;">
<a href="https://kookmaatje.eu" style="text-decoration:none;"><img src="${LOGO}" width="220" alt="Kookmaatje" style="display:block;border:0;width:220px;max-width:100%;height:auto;"></a>
</td></tr>
<tr><td style="padding:32px 28px 8px;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:#141414;">
<h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;color:#141414;">Nieuw wachtwoord kiezen</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.5;">Je hebt gevraagd om een nieuw wachtwoord voor je Kookmaatje-account. Tik op de knop en kies er een van minstens 8 tekens.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr><td style="background:#AB2328;border-radius:999px;">
<a href="${href}" style="display:inline-block;padding:16px 32px;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;font-size:16px;font-weight:700;color:#FFF6E8;text-decoration:none;">Kies een nieuw wachtwoord</a>
</td></tr></table>
<p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#5a5a5a;">De link werkt ${verlooptInMinuten} minuten en maar één keer. Werkt de knop niet? Plak dan deze link in je browser:</p>
<p style="margin:0 0 24px;font-size:13px;line-height:1.4;word-break:break-all;"><a href="${href}" style="color:#AB2328;">${href}</a></p>
</td></tr>
<tr><td style="padding:0 28px 32px;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
<p style="margin:0;padding-top:20px;border-top:1.5px solid #EFE6D6;font-size:13px;line-height:1.5;color:#5a5a5a;">Niet jij? Dan hoef je niets te doen: je wachtwoord blijft zoals het was.</p>
</td></tr>
</table>
<p style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#8a8170;">Kookmaatje · <a href="https://kookmaatje.eu" style="color:#8a8170;">kookmaatje.eu</a></p>
</td></tr>
</table>
</body>
</html>`
  const tekst = `Nieuw wachtwoord kiezen

Je hebt gevraagd om een nieuw wachtwoord voor je Kookmaatje-account. Open deze link en kies er een van minstens 8 tekens:

${link}

De link werkt ${verlooptInMinuten} minuten en maar één keer.

Niet jij? Dan hoef je niets te doen: je wachtwoord blijft zoals het was.

Kookmaatje · kookmaatje.eu
`
  return { onderwerp, html, tekst }
}
