import { ArrowRight, BookOpen, Bot, GitBranch, Layers3, PackageOpen, Printer } from 'lucide-react';
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
      title: 'Rulebook',
      text: summary.rulesStarted
        ? `${summary.chapters} chapters started. Edit your rules or ask the AI agent to draft a revision.`
        : 'Write your rules or ask the AI agent to draft a rulebook from your brief.',
      section: 'rules' as const,
      action: 'Write rules',
    },
    {
      icon: Layers3,
      title: 'Components',
      text: summary.designSets
        ? `${summary.designSets} component sets · ${summary.componentCopies} physical copies. Edit their layers, refine the data, or generate a new batch.`
        : 'Design cards, boards, tokens, tiles, mats, and pieces with editable templates and tables.',
      section: 'component_editor' as const,
      action: 'Components',
    },
    {
      icon: Bot,
      title: 'Playtests',
      text: 'Record a session, run a supported agent simulation, or export a brief for an AI reviewer.',
      section: 'playtest' as const,
      action: 'Playtest lab',
    },
    {
      icon: GitBranch,
      title: 'Version history',
      text: versionCount
        ? `${versionCount} saved checkpoint${versionCount === 1 ? '' : 's'}. Compare changes or start an experiment branch.`
        : 'Save your first checkpoint before you make the next big change.',
      section: 'versions' as const,
      action: 'Save a version',
    },
    {
      icon: Printer,
      title: 'Print and export',
      text: 'Export actual-size component sheets, a printable rulebook, or a full project backup.',
      section: 'print' as const,
      action: 'Prepare to print',
    },
  ];

  return (
    <section className="workshop-surface workshop-overview" aria-labelledby="project-workshop-title">
      <header className="workshop-surface__header">
        <div data-layout="projectWorkshopHeading">
          <h1 id="project-workshop-title">Project overview</h1>
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
            <h2>Plan a playtest</h2>
            <p>
              Save a checkpoint, choose a question to test, and record the findings alongside your design.
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
        <span>Save checkpoints in Versions to track design changes.</span>
        <span>
          {projectPlayerLabel(project)}{project.brief.theme ? ` · ${project.brief.theme}` : ''}
        </span>
      </footer>
    </section>
  );
}
