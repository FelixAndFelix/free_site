import { Link } from "react-router";
import { CaretRight } from "@phosphor-icons/react";
import type { ModuleOverview } from "@free-site/shared";
import { VoteBar } from "./VoteBar";
import { VoteButtons } from "./VoteButtons";

interface ModuleTileProps {
  module: ModuleOverview;
  onChange: (module: ModuleOverview) => void;
}

/**
 * One module in the overview: the course's vote shares, the user's vote buttons and a link to the history.
 * @param {ModuleTileProps} props
 */
export function ModuleTile({ module, onChange }: ModuleTileProps) {
  return (
    <article className="card module-tile">
      <h3>
        <Link to={`/modules/${module.id}`} className="module-link">
          {module.name}
          <CaretRight className="module-link-icon" aria-hidden="true" />
        </Link>
      </h3>
      <VoteBar counts={module.counts} />
      <VoteButtons module={module} onChange={onChange} />
    </article>
  );
}
