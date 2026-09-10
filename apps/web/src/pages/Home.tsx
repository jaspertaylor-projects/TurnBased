import { ArrowRight, Bot, Check, GitBranch, Layers3, Leaf, Printer } from 'lucide-react';
import '../components/workshop/workshop.css';

const steps = [
  { number: '01', title: 'Draft rules', text: 'Describe your game to an AI agent. Review and apply its rulebook draft.' },
  {
    number: '02',
    title: 'Design components',
    text: 'Build cards, boards, and tokens with editable templates and tables.',
  },
  {
    number: '03',
    title: 'Test and revise',
    text: 'Record playtest findings and compare changes across saved versions.',
  },
  {
    number: '04',
    title: 'Export a prototype',
    text: 'Print components at actual size and export a portable project backup.',
  },
];

export const Home = () => (
  <div data-layout="workshopLanding" className="workshop-home">
    <section className="workshop-hero" aria-labelledby="workshop-hero-title">
      <div data-layout="heroIntroduction" className="workshop-hero__copy">
        <p className="workshop-eyebrow">
          <Leaf size={15} /> Board game design
        </p>
        <h1 id="workshop-hero-title">
          Rules, components, and playtests in one workspace.
        </h1>
        <p className="workshop-hero__description">
          Draft your rules with an AI agent, design the pieces, and track revisions through to a
          printable prototype.
        </p>
        <div data-layout="heroActions" className="workshop-actions">
          <a href="#/new" id="cta-start" className="workshop-button workshop-button--primary">
            Create a game <ArrowRight size={17} />
          </a>
          <a href="#/dashboard" className="workshop-button workshop-button--text">
            Open my workshop
          </a>
        </div>
        <p className="workshop-hero__assurance">
          <Check size={14} /> Start without an account <span>·</span> AI tools require sign-in
        </p>
      </div>
      <figure className="workshop-demo" aria-labelledby="workshop-demo-caption">
        <video
          controls
          playsInline
          preload="none"
          poster="/demo/turnbased-ai-rules.jpg"
          aria-label="Watch an AI agent write a game rulebook in TurnBased"
        >
          <source src="/demo/turnbased-ai-rules.mp4" type="video/mp4" />
          <track kind="captions" src="/demo/turnbased-ai-rules.vtt" srcLang="en" label="English" />
          <a href="/demo/turnbased-ai-rules.mp4">Watch the AI rulebook demo</a>
        </video>
        <figcaption id="workshop-demo-caption">Watch the AI agent draft rules, then review and apply them.</figcaption>
      </figure>
    </section>

    <section className="workshop-loop" aria-label="The game design journey">
      {steps.map((step) => (
        <article key={step.number}>
          <span>{step.number}</span>
          <h2>{step.title}</h2>
          <p>{step.text}</p>
        </article>
      ))}
    </section>

    <section className="workshop-tools" aria-labelledby="workshop-tools-title">
      <header className="workshop-section-heading">
        <h2 id="workshop-tools-title">Design and production tools</h2>
      </header>
      <div data-layout="workshopFeatureGrid" className="workshop-feature-grid">
        <article className="workshop-feature workshop-feature--versions">
          <GitBranch size={25} />
          <h3>Version history</h3>
          <p>
            Save a checkpoint before a big change. Compare your work, try a new branch, and return to an
            earlier design when you need it.
          </p>
          <div
            data-layout="versionHistoryIllustration"
            className="workshop-version-demo"
            aria-label="Example version history"
          >
            <span>
              <i /> Initial prototype <small>v1</small>
            </span>
            <span>
              <i /> Shorter turns <small>v2</small>
            </span>
            <span>
              <i /> Wild card experiment <small>v3</small>
            </span>
          </div>
        </article>
        <article className="workshop-feature workshop-feature--cards">
          <Layers3 size={25} />
          <h3>Templates and component data</h3>
          <p>
            Put your card ideas in a table. Choose a design, bind the fields, and make a consistent deck
            without laying out every card by hand.
          </p>
          <div data-layout="cardTableIllustration" className="workshop-table-demo" aria-hidden="true">
            <span>Name</span>
            <span>Cost</span>
            <span>Copies</span>
            <strong>Wild fern</strong>
            <span>2</span>
            <span>4</span>
            <strong>Moonlit path</strong>
            <span>3</span>
            <span>2</span>
            <strong>Sunlight</strong>
            <span>1</span>
            <span>6</span>
          </div>
        </article>
        <article className="workshop-feature">
          <Bot size={25} />
          <h3>Playtest records and simulations</h3>
          <p>
            Keep playtest notes beside your design. Run repeatable agent simulations of a supported game
            model, and export a brief for an AI reviewer.
          </p>
          <span className="workshop-feature__note">Simulations use the supported two-player market-race model.</span>
        </article>
        <article className="workshop-feature">
          <Printer size={25} />
          <h3>Prototype printing</h3>
          <p>
            Export actual-size component sheets, duplex card layouts, large tiled boards, and a printable
            rulebook. Review supplier matches and production estimates.
          </p>
          <span className="workshop-feature__note">
            Supplier orders are prepared for review; checkout happens with the supplier.
          </span>
        </article>
      </div>
    </section>

    <section className="workshop-invitation" aria-labelledby="workshop-invitation-title">
      <h2 id="workshop-invitation-title">Start a new project</h2>
      <a href="#/new" className="workshop-button workshop-button--primary">
        Create a game <ArrowRight size={17} />
      </a>
    </section>
    <footer className="workshop-home-footer">
      <a href="#/" className="workshop-wordmark">
        <Leaf size={18} /> TurnBased<span>.</span>
      </a>
      <p>Board game design and prototyping.</p>
      <span>Projects are saved in your browser. Export backups to keep a copy.</span>
    </footer>
  </div>
);
