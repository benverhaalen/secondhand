// Where the auto-list tree stopped, as one card with one question (spec/edge-cases.md §7, agent proposal: "every stop is a
// card with one question, so a stopped tree costs a tap, not a restart"). Which step it stopped at in a caption, the
// question in the headline, and its answers as chips, the one the agent could pick already picked. Answering fills the
// item; the screen then puts the next stop in the same card, or says nothing is left. A card: the card's corner, padding
// and edge (Art. 7.8, 9.2); the words start at the corner's inset, as the decision card's countdown does, so none sits in
// the curve (U5).
import { View } from 'react-native';
import { Surface } from '../surface';
import { Txt } from '../text';
import { size, space } from '../tokens.generated';
import { Chips, type Chip } from './chips';

export function QuestionCard({ id, where, question, options, pick, typed, onAnswer }: {
  // The question's id: its chips are `${id}-${option}` in the log and in tests.
  id: string;
  // Where the tree stopped: "Step 4 of 9: Facts a camera can’t see".
  where: string;
  // One question; null when nothing is left to ask, and the caption says it is ready.
  question: string | null;
  options?: Chip[];
  pick?: string | null;
  // The person can type an answer of their own.
  typed?: boolean;
  onAnswer?: (value: string, typed: boolean) => void;
}) {
  return (
    <Surface kind="card" part="question-card" box={{ padding: size.cardPad, gap: space.s3 }}>
      <View style={{ gap: space.s1, paddingHorizontal: size.cardCorner - size.cardPad }}>
        <Txt role="caption">{where}</Txt>
        {question ? <Txt role="headline">{question}</Txt> : null}
      </View>
      {question && options && onAnswer
        ? <Chips id={id} name={question} options={options} value={pick ?? null} onChange={onAnswer} other={typed ? {} : undefined} />
        : null}
    </Surface>
  );
}
