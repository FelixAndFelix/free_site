import { Link } from "react-router";
import { ArrowLeft } from "@phosphor-icons/react";

/**
 * A quiet link back to a parent page, shown above a page's heading.
 * @param {{to: string, children: string}} props
 */
export function BackLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className="back-link">
      <ArrowLeft aria-hidden="true" />
      {children}
    </Link>
  );
}
