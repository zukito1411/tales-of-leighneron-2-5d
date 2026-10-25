export type ScreenTransitionKind='sail'|'sleep'|'travel';
export type ScreenTransitionPhase='fade-out'|'covered'|'night'|'morning'|'fade-in';
/** Session-only presentation state; never serialized into a game save. */
export interface ScreenTransitionState {
  id:number;kind:ScreenTransitionKind;phase:ScreenTransitionPhase;
  label:string;duration:number;nightDuration:number;paused:boolean;
}
