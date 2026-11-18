import type { Block } from '../../content/types';
import { RichText } from '../../ui/RichText';
import { SpeakButton } from '../../ui/SpeakButton';

/** Menampilkan blok penjelasan: paragraf, tabel, contoh, kesalahan umum, tips. */
export function ContentBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="blocks">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'p':
            return (
              <p key={i}>
                <RichText text={b.text} />
              </p>
            );
          case 'tip':
            return (
              <div key={i} className="tip">
                <RichText text={b.text} />
              </div>
            );
          case 'table':
            return (
              <div key={i} className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      {b.head.map((h, j) => (
                        <th key={j}>
                          <RichText text={h} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (
                          <td key={k}>
                            <RichText text={c} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'examples':
            return (
              <ul key={i} className="examples">
                {b.items.map((ex, j) => (
                  <li key={j}>
                    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      <SpeakButton text={ex.en.replace(/→.*$/, '')} />
                      <span className="en">
                        <RichText text={ex.en} />
                      </span>
                    </div>
                    <div className="muted small">
                      <RichText text={ex.id} />
                    </div>
                    {ex.note && <div className="small">{ex.note}</div>}
                  </li>
                ))}
              </ul>
            );
          case 'mistakes':
            return (
              <div key={i} className="mistakes">
                {b.items.map((m, j) => (
                  <div key={j} className="mistake">
                    <div className="wrong">
                      <span aria-hidden="true">✗</span> <RichText text={m.wrong} />
                    </div>
                    <div className="right">
                      <span aria-hidden="true">✓</span> <RichText text={m.right} />
                    </div>
                    <div className="muted small">
                      <RichText text={m.why} />
                    </div>
                  </div>
                ))}
              </div>
            );
        }
      })}
    </div>
  );
}
