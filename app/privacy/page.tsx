import Link from 'next/link';

export const metadata = {
  title: 'Privacyverklaring — Team Manager',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-300 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Privacyverklaring</h1>
        <p className="text-sm text-gray-500 mb-10">Laatste update: maart 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-white mb-2">Over deze app</h2>
            <p>
              Team Manager is een applicatie voor het beheren van amateurvoetbalteams.
              De app wordt privé aangeboden en is niet commercieel. De beheerder van de
              app is de persoon die het team heeft aangemaakt.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">Welke gegevens bewaren we?</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>Naam en e-mailadres (opgegeven bij registratie)</li>
              <li>Profielfoto (optioneel, alleen als je deze zelf uploadt)</li>
              <li>Sportprestaties: goals, assists, speelminuten, kaarten</li>
              <li>Aanwezigheidsdata per wedstrijd (aanwezig/afwezig)</li>
              <li>Stemgedrag bij de Speler van de Week-verkiezing</li>
              <li>Creditbalans en -transacties voor het aanpassen van statistieken</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">Waarom bewaren we dit?</h2>
            <p>
              De gegevens worden uitsluitend gebruikt om de app te laten functioneren:
              het bijhouden van teamstatistieken, de opstellingsbeheer en de communicatie
              binnen het team. De wettelijke grondslag is de uitvoering van de overeenkomst
              (AVG art. 6 lid 1 sub b). Er worden geen gegevens gebruikt voor advertenties
              of andere commerciële doeleinden.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">Hoe lang bewaren we gegevens?</h2>
            <p>
              Gegevens worden bewaard zolang je lid bent van een team. Als een team
              wordt opgeheven door de beheerder, worden alle bijbehorende gegevens
              permanent verwijderd. Als je je account verwijdert, wordt je naam
              geanonimiseerd en worden je koppeling en profielfoto verwijderd.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">Jouw rechten</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>
                <strong className="text-gray-300">Inzagerecht:</strong> je kunt je gegevens
                inzien via je profielpagina in de app.
              </li>
              <li>
                <strong className="text-gray-300">Rectificatierecht:</strong> je kunt je naam,
                e-mailadres en profielfoto aanpassen via Mijn profiel.
              </li>
              <li>
                <strong className="text-gray-300">Verwijderingsrecht:</strong> je kunt je account
                permanent verwijderen via{' '}
                <span className="text-gray-300">Mijn profiel → Verwijder mijn account</span>.
                Je naam wordt dan geanonimiseerd; statistieken blijven bewaard voor de teamhistorie.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">Verwerkers (sub-processors)</h2>
            <p>
              We gebruiken{' '}
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                Supabase
              </a>{' '}
              (Dublin, Ierland) voor dataopslag en authenticatie. Supabase is AVG-compliant,
              is gecertificeerd onder het EU-US Data Privacy Framework, en verwerkt gegevens
              uitsluitend in opdracht van de beheerder van deze app. Er is een
              verwerkersovereenkomst (DPA) met Supabase gesloten.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">Cookies</h2>
            <p>
              Deze app gebruikt uitsluitend functionele cookies voor authenticatie
              (sessiecookies van Supabase). Er worden geen tracking-, analytische of
              advertentiecookies gebruikt.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">Contact</h2>
            <p>
              Heb je vragen over je privacy of wil je gebruik maken van je rechten?
              Neem contact op met de beheerder van je team.
            </p>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t border-gray-800">
          <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">
            ← Terug naar de app
          </Link>
        </div>
      </div>
    </div>
  );
}
