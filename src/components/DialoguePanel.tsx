import { Component, type ErrorInfo, type ReactNode } from 'react';
import { NPC_BY_ID } from '../data/npcs';
import { useGameStore } from '../store/gameStore';
import { SpritePortrait } from './SpritePortrait';
import {MerchantStock} from './MerchantStock';
import {NpcServices} from './NpcServices';
import {AliceCompanionService} from './AliceCompanionService';
import {BreakthroughService} from './BreakthroughService';

export function DialoguePanel() {
  const dialogue = useGameStore((s) => s.dialogue);
  const advance = useGameStore((s) => s.advanceDialogue);
  const end = useGameStore((s) => s.endDialogue);
  const choose=useGameStore(s=>s.chooseDialogue);
  const logicalStates = useGameStore(s => s.worldContent.states);
  if (!dialogue) return null;
  const npc = NPC_BY_ID[dialogue.npcId]??dialogue.localNpc;
  if (!npc) return <div className="dialogue-wrap"><section className="dialogue-panel" role="alert">
    <p>This resident is no longer available.</p><button type="button" onClick={end}>Close conversation</button>
  </section></div>;

  const lines=dialogue.lines??npc.dialogue;
  const line = lines[Math.min(dialogue.lineIndex, lines.length - 1)];
  const finalLine = dialogue.lineIndex >= lines.length - 1;

  return (
    <div className="dialogue-wrap">
      <section className="dialogue-panel dialogue-panel--scroll-layout" aria-label={`Conversation with ${npc.name}`}>
        <div className="dialogue-toolbar">
          <button type="button" className="dialogue-close-button" aria-label="Close conversation" onClick={end}>Close ×</button>
        </div>
        <div className="dialogue-content-scroll">
          <div className="dialogue-speaker">
            <SpritePortrait npc={npc} frame={npc.spriteFrame} texture={npc.spriteTexture} name={npc.name} />
            <div className="dialogue-identity"><strong>{npc.name}</strong><span>{npc.title}</span>
              <small>Trust {logicalStates[`npc:${npc.id}`]?.trust ?? npc.relationshipToLeigneron.trust} / 100</small>
            </div>
          </div>
          <p>{line}</p>
          <div className="relationship-note">{npc.relationshipToLeigneron.kind}: {npc.relationshipToLeigneron.summary}</div>
          {finalLine&&!dialogue.choices?.length&&<>
            <AliceCompanionService npcId={npc.id}/>
            {!dialogue.questId&&<BreakthroughService npcId={npc.id}/>}
            {!dialogue.questId&&<NpcServices npcId={npc.id}/>}
            <MerchantStock npcId={npc.id}/>
          </>}
          {finalLine&&dialogue.choices?.length&&
            <div className="dialogue-choices">
              {dialogue.choices.map(choice=><button type="button" key={choice.id} onClick={()=>choose(choice.id)}>{choice.text}</button>)}
            </div>}
        </div>
        <div className="dialogue-actions">
          {finalLine&&dialogue.choices?.length
            ? <button type="button" onClick={end}>Decide later</button>
            : <button type="button" onClick={finalLine ? end : advance}>{finalLine ? 'Close' : 'Continue'}</button>}
        </div>
      </section>
    </div>
  );
}

/**
 * A broken NPC portrait or future dialogue-only render error must not unmount
 * the Phaser game or trap the player in a bad interaction. The wrapper is
 * unmounted whenever the dialogue closes, resetting its error state.
 */
class DialogueRenderBoundary extends Component<
  { children: ReactNode }, { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Dialogue UI render failed:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="dialogue-wrap">
        <section className="dialogue-panel" role="alert">
          <p>This conversation could not be displayed. Your progress is safe.</p>
          <button type="button" onClick={() => useGameStore.getState().endDialogue()}>
            Close conversation
          </button>
        </section>
      </div>
    );
  }
}

/** Mount a fresh boundary for each conversation; don't retain an error state. */
export function SafeDialoguePanel() {
  const npcId = useGameStore(state => state.dialogue?.npcId);
  if (!npcId) return null;
  return <DialogueRenderBoundary key={npcId}><DialoguePanel /></DialogueRenderBoundary>;
}
