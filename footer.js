class SiteFooter extends HTMLElement {
  connectedCallback() {
    const caption = this.getAttribute('caption') ?? 'PRM Prüfungsvorbereitung · Lernpfad V5';
    this.innerHTML = `
      <footer class="footer">
        <div class="container footer-inner">
          <small class="footer-caption">${caption}</small>
          <small class="footer-attribution">
            Inhalt basiert auf der Vorlesungsgrundlage von
            <strong>Prof. Dr. rer. nat. Markus Goldhacker</strong> –
            Fach <em>Predictive Maintenance</em>,
            Studiengang Produktions- und Automatisierungstechnik · OTH
          </small>
        </div>
      </footer>`;
  }
}
customElements.define('site-footer', SiteFooter);
