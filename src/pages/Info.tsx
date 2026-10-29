export default function Info() {
  return (
    <main className="container">
      <div className="card">
        <h1>Informations</h1>
        <p>
          <span className="app-name">Réplique</span>, l'appli qui vous aide à apprendre votre texte !
        </p>
        <ul>
          <li>Importez un texte à partir d'un fichier.</li>
          <li>L'appli reconnait les personnages, les actes et les scènes.</li>
          <li>Vous sélectionnez votre rôle parmi les personnages.</li>
          <li>
            Lancez la répétition d'une scène : l'appli joue les différents personnages, et vous laisse dire votre
            réplique quand c'est à vous. Si la réplique est exacte (ou presque), la scène continue. Sinon elle attend
            la bonne réplique.
          </li>
          <li>En cas de trou, un bouton "indice" affiche les premiers mots de votre réplique. ;)</li>
          <li>En cours de lecture, mettez en pause, revenez au début, ou à la réplique de votre choix.</li>
          <li>À tout moment un bouton "éditer" vous permet de corriger ou d'ajouter une réplique.</li>
          <li>Toutes les corrections apportées au texte sont partagées aux autres utilisateurs.</li>
        </ul>
      </div>
    </main>
  )
}
