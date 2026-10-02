import FaDropdown from "./FaDropdown";
import { useTranslator } from "./translator";

export type TableCommand =
  | "columnHeader"
  | "columnInsertLeft"
  | "columnInsertRight"
  | "columnDelete"
  | "rowHeader"
  | "rowInsertAbove"
  | "rowInsertBelow"
  | "rowDelete"
  | "mergeUp"
  | "mergeRight"
  | "mergeDown"
  | "mergeLeft"
  | "splitVertically"
  | "splitHorizontally"
  | "tableDelete";

interface Group {
  name: string;
  label: string;
  icon: string;
  actions: { command: TableCommand; label: string }[];
}

const GROUPS: Group[] = [
  {
    name: "column",
    label: "column",
    icon: "column",
    // Grouped the way the table menu reads: column, row, cells, table.
    actions: [
      { command: "columnHeader", label: "headerColumn" },
      { command: "columnInsertLeft", label: "insertColumnLeft" },
      { command: "columnInsertRight", label: "insertColumnRight" },
      { command: "columnDelete", label: "deleteColumn" },
    ],
  },
  {
    name: "row",
    label: "row",
    icon: "row",
    actions: [
      { command: "rowHeader", label: "headerRow" },
      { command: "rowInsertAbove", label: "insertRowAbove" },
      { command: "rowInsertBelow", label: "insertRowBelow" },
      { command: "rowDelete", label: "deleteRow" },
    ],
  },
  {
    name: "merge",
    label: "mergeCells",
    icon: "mergeCells",
    actions: [
      { command: "mergeUp", label: "mergeUp" },
      { command: "mergeRight", label: "mergeRight" },
      { command: "mergeDown", label: "mergeDown" },
      { command: "mergeLeft", label: "mergeLeft" },
      { command: "splitVertically", label: "splitVertically" },
      { command: "splitHorizontally", label: "splitHorizontally" },
    ],
  },
  {
    name: "table",
    label: "table",
    icon: "trash",
    actions: [{ command: "tableDelete", label: "deleteTable" }],
  },
];

interface Props {
  onCommand: (command: TableCommand) => void;
}

export default function FaTableBalloon({ onCommand }: Props) {
  const t = useTranslator();

  return (
    <div className="fa-wysiwyg-table-tools">
      {GROUPS.map((group) => (
        <FaDropdown key={group.name} title={t(group.label)} icon={group.icon}>
          {(close) => (
            <ul className="fa-wysiwyg-panel__list">
              {group.actions.map((action) => (
                <li key={action.command}>
                  <button
                    type="button"
                    className="fa-wysiwyg-panel__item"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      close();
                      onCommand(action.command);
                    }}
                  >
                    <span className="fa-wysiwyg-panel__item-text">
                      {t(action.label)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </FaDropdown>
      ))}
    </div>
  );
}
