import type { Word } from '../../content/types';
import { SpeakButton } from '../../ui/SpeakButton';

/** Semua lapis informasi sebuah kata: bunyi, arti inti, contoh, jebakan, keluarga kata, pasangan kata. */
export function WordDetails({ word, compact = false }: { word: Word; compact?: boolean }) {
  return (
    <div className="word-details">
      <div className="row" style={{ gap: 8 }}>
        <span className="word-title">{word.word}</span>
        <SpeakButton text={word.word} />
        <SpeakButton text={word.word} slow />
      </div>
      <div className="muted small">
        {word.ipa} · <strong>{word.say}</strong> · {word.pos} · {word.cefr}
      </div>
      <div className="meaning">{word.meaning}</div>
      <p className="small">
        <strong>Arti inti:</strong> {word.core}
      </p>
      <div className="example">
        <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
          <SpeakButton text={word.example} />
          <span className="en">{word.example}</span>
        </div>
        <div className="muted small">{word.exampleId}</div>
      </div>
      {!compact && word.trap && (
        <div className="tip small">
          <strong>Jebakan:</strong> {word.trap}
        </div>
      )}
      {!compact && word.family && (
        <p className="small">
          <strong>Keluarga kata:</strong> {word.family.join(' · ')}
        </p>
      )}
      {!compact && word.collocations && (
        <p className="small">
          <strong>Pasangan lazim:</strong> {word.collocations.join(' · ')}
        </p>
      )}
    </div>
  );
}
