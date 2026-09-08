import { ArrowRight, Bot, Check, GitBranch, Layers3, Leaf, Printer, Sparkles } from 'lucide-react';
import { WorkshopArt } from '../components/workshop/WorkshopArt';
import '../components/workshop/workshop.css';

const steps = [
  { number: '01', title: 'Make something', text: 'A few rules. A handful of cards. Enough to find the fun.' },
  {
    number: '02',
    title: 'Bring it to the table',
    text: 'Try a prototype, record what happened, and test your assumptions.',
  },
  {
    number: '03',
    title: 'Try another version',
    text: 'Save the good ideas. Explore a different direction. Keep your history.',
  },
  {
    number: '04',
    title: 'Make it real',
    text: 'Print a card sheet, cut it out, and play another round with friends.',
  },
];

export const Home = () => (
  <div data-layout="workshopLanding" className="workshop-home">
    <section className="workshop-hero" aria-labelledby="workshop-hero-title">
      <div data-layout="heroIntroduction" className="workshop-hero__copy">
        <p className="workshop-eyebrow">
          <Leaf size={15} /> A little workshop for big game ideas
        </p>
        <h1 id="workshop-hero-title">
          Your game.
          <br />
          From <em>what if</em>
          <br />
          to game night.
        </h1>
        <p className="workshop-hero__description">
          Make a board game. Try it with friends. Make it better. Print it when you’re ready.
        </p>
        <div data-layout="heroActions" className="workshop-actions">
          <a href="#/new" id="cta-start" className="workshop-button workshop-button--primary">
            Make your first game <ArrowRight size={17} />
          </a>
          <a href="#/dashboard" className="workshop-button workshop-button--text">
            Open my workshop
          </a>
        </div>
        <p className="workshop-hero__assurance">
          <Check size={14} /> Start without an account <span>·</span> Your ideas stay yours
        </p>
      </div>
      <WorkshopArt />
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
        <p className="workshop-eyebrow">More making. Less setting things up.</p>
        <h2 id="workshop-tools-title">
          A home for every
          <br />
          <em>“let’s try that.”</em>
        </h2>
        <p>You don’t need a perfect idea to start. You need a place to keep making it better.</p>
      </header>
      <div data-layout="workshopFeatureGrid" className="workshop-feature-grid">
        <article className="workshop-feature workshop-feature--versions">
          <GitBranch size={25} />
          <h3>Be brave. Keep your versions.</h3>
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
              <i /> First playable idea <small>v1</small>
            </span>
            <span>
              <i /> A shorter, snappier turn <small>v2</small>
            </span>
            <span>
              <i /> What if we add a wild card? <small>v3</small>
            </span>
          </div>
        </article>
        <article className="workshop-feature workshop-feature--cards">
          <Layers3 size={25} />
          <h3>One template. A whole deck.</h3>
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
            <strong>A little sunshine</strong>
            <span>1</span>
            <span>6</span>
          </div>
        </article>
        <article className="workshop-feature">
          <Bot size={25} />
          <h3>A place to ask “is this fun?”</h3>
          <p>
            Keep playtest notes beside your design. Run repeatable agent simulations of a supported game
            model, and export a brief for an AI reviewer.
          </p>
          <span className="workshop-feature__note">
            Test an idea. Inspect the evidence. Decide what changes.
          </span>
        </article>
        <article className="workshop-feature">
          <Printer size={25} />
          <h3>From your screen to your table.</h3>
          <p>
            Prepare printable card sheets and check your prototype’s readiness. Explore physical components as
            you work toward a game you can hold.
          </p>
          <span className="workshop-feature__note">
            Home printing now. Physical production is the next chapter.
          </span>
        </article>
      </div>
    </section>

    <section className="workshop-invitation" aria-labelledby="workshop-invitation-title">
      <Sparkles size={24} />
      <p className="workshop-eyebrow">For first-time makers and serial tinkerers</p>
      <h2 id="workshop-invitation-title">
        The best version of your game
        <br />
        starts with the first one.
      </h2>
      <a href="#/new" className="workshop-button workshop-button--primary">
        Let’s make something <ArrowRight size={17} />
      </a>
    </section>
    <footer className="workshop-home-footer">
      <a href="#/" className="workshop-wordmark">
        <Leaf size={18} /> TurnBased<span>.</span>
      </a>
      <p>A cozy place to make, test, and improve board games.</p>
      <span>Made for the love of game night.</span>
    </footer>
  </div>
);
