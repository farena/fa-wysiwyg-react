import { useState, type CSSProperties } from "react";
import { TABLE_GRID_SIZE } from "../core/constants";

export interface TableSize {
  rows: number;
  cols: number;
}

interface Props {
  onSelect: (size: TableSize) => void;
}

const CELLS: TableSize[] = [];
for (let row = 1; row <= TABLE_GRID_SIZE; row++) {
  for (let col = 1; col <= TABLE_GRID_SIZE; col++) CELLS.push({ rows: row, cols: col });
}

export default function FaTableGrid({ onSelect }: Props) {
  const [hover, setHover] = useState<TableSize>({ rows: 0, cols: 0 });

  return (
    <div
      className="fa-wysiwyg-table-grid"
      onMouseLeave={() => setHover({ rows: 0, cols: 0 })}
    >
      <div
        className="fa-wysiwyg-table-grid__grid"
        style={{ "--fa-wysiwyg-grid-size": TABLE_GRID_SIZE } as CSSProperties}
      >
        {CELLS.map((cell) => (
          <button
            key={`${cell.rows}-${cell.cols}`}
            type="button"
            className={[
              "fa-wysiwyg-table-grid__cell",
              cell.rows <= hover.rows &&
                cell.cols <= hover.cols &&
                "fa-wysiwyg-table-grid__cell--on",
            ]
              .filter(Boolean)
              .join(" ")}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setHover(cell)}
            onClick={() => onSelect(cell)}
          />
        ))}
      </div>
      <p className="fa-wysiwyg-table-grid__label">
        {hover.rows} &times; {hover.cols}
      </p>
    </div>
  );
}
