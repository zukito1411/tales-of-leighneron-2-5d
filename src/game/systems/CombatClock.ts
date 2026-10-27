/** Combat deadlines advance only alongside simulation. Menus, loading,
 * cinematics and background time cannot consume a dodge or enemy windup. */
export class CombatClock {
  now=0;
  advance(delta:number){
    if(Number.isFinite(delta))this.now+=Math.max(0,Math.min(delta,250));
    return this.now;
  }
  reset(){this.now=0;}
}
