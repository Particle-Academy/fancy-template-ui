import { Badge, Button, Card, Text } from "@particle-academy/react-fancy";
import type { Proposal } from "@particle-academy/fancy-doc-commons";
import { useBuilder } from "./context";
import { checkOp } from "./core/ops";
import type { BuilderOp } from "./core/types";

export interface PendingChangesProps {
  pending: readonly Proposal<BuilderOp>[];
  onAccept(proposal: Proposal<BuilderOp>): void;
  onReject(proposal: Proposal<BuilderOp>): void;
  className?: string;
}

function describe(op: BuilderOp): string {
  switch (op.t) {
    case "insert":
      return `Add a ${op.node.type.replace(/^host:/, "")} block`;
    case "remove":
      return "Remove a block";
    case "move":
      return "Move a block";
    case "set_props":
      return `Change a block (${Object.keys(op.patch).join(", ")})`;
    case "set_style":
      return `Restyle a block (${Object.keys(op.patch).join(", ")})`;
    case "set_page":
      return `Change the page (${Object.keys(op.patch).join(", ")})`;
  }
}

/**
 * Agent edits waiting for a person. Only a person accepts: nothing here is
 * reachable by the bridge, which stages and never confirms.
 */
export function PendingChanges({ pending, onAccept, onReject, className }: PendingChangesProps) {
  const { state, kinds, readOnly } = useBuilder();
  if (pending.length === 0) return null;
  return (
    <Card className={className} padding="md" data-ftb-pending-list="">
      <Card.Header>
        <span className="font-semibold">Suggested changes</span> <Badge size="sm" color="blue">{pending.length}</Badge>
      </Card.Header>
      <Card.Body>
        <ul className="flex flex-col gap-2">
          {pending.map((p) => {
            const blocked = checkOp(state, p.op, kinds);
            return (
              <li key={p.id} data-ftb-pending={p.id} className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Text size="sm">{p.label ?? describe(p.op)}</Text>
                  {p.actor?.name && <Text size="xs" color="muted">from {p.actor.name}</Text>}
                  {blocked && <Text size="xs" color="danger">{blocked}</Text>}
                </div>
                <Button type="button" size="xs" color="green" disabled={readOnly || blocked !== null} data-ftb-accept={p.id} onClick={() => onAccept(p)}>
                  Accept
                </Button>
                <Button type="button" size="xs" variant="ghost" data-ftb-reject={p.id} onClick={() => onReject(p)}>
                  Reject
                </Button>
              </li>
            );
          })}
        </ul>
      </Card.Body>
    </Card>
  );
}
