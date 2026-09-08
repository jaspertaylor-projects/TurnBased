import { ArrowRight, BookOpen, Bot, GitBranch, Layers3, Leaf, PackageOpen, Printer } from 'lucide-react';
import type { EditorProject } from '../types';
import type { EditorSection } from '../constants';
import { projectPlayerLabel, summarizeProject } from '../../components/workshop/projectSummary';
import '../../components/workshop/workshop.css';

interface WorkshopSectionProps {
  project: EditorProject;
  onNavigate: (section: EditorSection) => void;
  versionCount?: number;
}

export function WorkshopSection({ project, onNavigate, versionCount = 0 }: WorkshopSectionProps) {
  const summary = summarizeProject(project, versionCount);
  const steps = [
    {
      icon: BookOpen,
      title: 'Give your idea a few rules',
      text: summary.rulesStarted
        ? `${summary.chapters} chapters started. Make the next turn easy to explain.`
        : 'Start with the goal, what a player does, and how the game ends.',
      section: 'rules' as const,
      action: 'Write rules',
    },
    {
      icon: Layers3,
      title: 'Make the pieces your game needs',
      text: summary.designSets
        ? `${summary.designSets} component sets · ${summary.componentCopies} physical copies. Edit their layers, refine the data, or generate a new batch.`
        : 'Design cards, boards, tokens, tiles, mats, and pieces with editable templates and tables.',
      section: 'component_editor' as const,
      action: 'Components',
    },
    {
      icon: Bot,
      title: 'Find out what needs another try',
      text: 'Record a session, run a supported agent simulation, or export a brief for an AI reviewer.',
      section: 'playtest' as const,
      action: 'Playtest lab',
    },
    {
      icon: GitBranch,
      title: 'Keep the good ideas. Try new ones.',
      text: versionCount
        ? `${versionCount} saved checkpoint${versionCount === 1 ? '' : 's'}. Give your next experiment a name.`
        : 'Save your first checkpoint before you make the next big change.',
      section: 'versions' as const,
      action: 'Save a version',
    },
    {
      icon: Printer,
      title: 'Put your prototype on the table',
      text: 'Prepare cards, boards, and other pieces at their real size for the next game night.',
      section: 'print' as const,
      action: 'Prepare to print',
    },
  ];

  return (
    <section className="workshop-surface workshop-overview" aria-labelledby="project-workshop-title">
      <header className="workshop-surface__header">
        <div data-layout="projectWorkshopHeading">
          <p className="workshop-eyebrow">
            <Leaf size={13} /> A work in progress. A world of possibilities.
          </p>
          <h1 id="project-workshop-title">Let’s find the fun.</h1>
          <p className="workshop-surface__intro">Your next playable version starts with one small step.</p>
        </div>
      </header>
      <div data-layout="projectWorkshopBody" className="workshop-overview__body">
        <div data-layout="projectDesignSteps" className="workshop-overview__steps">
          {steps.map(({ icon: Icon, title, text, section, action }) => (
            <article className="workshop-step" key={section}>
              <Icon size={22} strokeWidth={1.5} />
              <div data-layout="designStepDescription" className="workshop-step__copy">
                <h2>{title}</h2>
                <p>{text}</p>
              </div>
              <button className="workshop-button" onClick={() => onNavigate(section)}>
                {action}
                <ArrowRight size={12} />
              </button>
            </article>
          ))}
        </div>
        <aside className="workshop-rail" aria-label="Prototype at a glance">
          <dl className="workshop-overview__stats">
            <div data-layout="componentDesignSetCount">
              <dd>{summary.designSets}</dd>
              <dt>Component sets</dt>
            </div>
            <div data-layout="physicalComponentCopyCount">
              <dd>{summary.componentCopies}</dd>
              <dt>Physical copies</dt>
            </div>
            <div data-layout="rulesChapterCount">
              <dd>{summary.chapters}</dd>
              <dt>Chapters started</dt>
            </div>
            <div data-layout="projectVersionCount">
              <dd>{versionCount}</dd>
              <dt>Checkpoints</dt>
            </div>
          </dl>
          <article className="workshop-tip">
            <GitBranch size={20} />
            <h2>One question per playtest.</h2>
            <p>
              “Is the first turn too slow?” is easier to learn from than “Is my game good?” Save a version,
              choose one question, and see what happens.
            </p>
            <button className="workshop-button" onClick={() => onNavigate('playtest')}>
              Plan a playtest <ArrowRight size={12} />
            </button>
          </article>
          <button
            className="workshop-button workshop-button--text"
            onClick={() => onNavigate('component_editor')}
          >
            <PackageOpen size={15} /> Explore all components <ArrowRight size={12} />
          </button>
        </aside>
      </div>
      <footer className="workshop-surface__footer">
        <span>Small steps count. Your prototype doesn’t need to be perfect to be playable.</span>
        <span>
          {projectPlayerLabel(project)} · {project.brief.theme || 'A theme of your own'}
        </span>
      </footer>
    </section>
  );
}
