import { useState } from 'react';
import type { Lesson } from '../../content/types';
import { RichText } from '../../ui/RichText';
import { ContentBlocks } from './ContentBlocks';

const LAYER_NUMBER: Record<string, string> = { simple: '1', pattern: '2', why: '3', when: '4', nuance: '5', origin: '6' };

/**
 * Pelajaran dibuka lapis demi lapis, bukan sekaligus, agar setiap lapis benar-benar dibaca.
 * Lapis opsional (asal-usul) bisa dilewati.
 */
export function LessonView({ lesson, onStartExercises }: { lesson: Lesson; onStartExercises: () => void }) {
  const [shown, setShown] = useState(1);
  const [openOptional, setOpenOptional] = useState<Record<number, boolean>>({});
  const layers = lesson.layers;
  const allShown = shown >= layers.length;

  return (
    <div className="page">
      <section className="card">
        <span className="badge teal">{lesson.cefr}</span>
        <h2>{lesson.title}</h2>
        <p className="muted">
          <RichText text={lesson.goal} />
        </p>
      </section>

      {layers.slice(0, shown).map((layer, i) => (
        <section className="card layer" key={i}>
          <div className="row between">
            <h3>
              Lapis {LAYER_NUMBER[layer.kind] ?? i + 1} · {layer.title}
            </h3>
            {layer.optional && <span className="badge">opsional</span>}
          </div>
          {layer.optional && !openOptional[i] ? (
            <button className="btn secondary" onClick={() => setOpenOptional({ ...openOptional, [i]: true })}>
              Pelajari lebih dalam
            </button>
          ) : (
            <ContentBlocks blocks={layer.blocks} />
          )}
        </section>
      ))}

      {!allShown ? (
        <button className="btn block" onClick={() => setShown(shown + 1)}>
          Lanjut ke lapis berikutnya ({shown + 1}/{layers.length})
        </button>
      ) : (
        <button className="btn block" onClick={onStartExercises}>
          Mulai latihan ({lesson.exercises.length} soal)
        </button>
      )}
    </div>
  );
}
