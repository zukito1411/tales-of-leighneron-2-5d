import type { ActiveSkillAction } from '../data/activeSkills';
export type MobileAction = 'attack' | 'dash' | 'jump' | 'interact' | 'healPotion' | 'staminaPotion' | ActiveSkillAction;

const mobile = {
  attackHeld:false,
  moveX: 0,
  moveY: 0,
  attack: false,
  dash: false,
  jump:false,
  interact: false,
  healPotion:false,staminaPotion:false,
  sprint: false,
  skill1:false,skill2:false,skill3:false,skill4:false,
};

export const mobileInput = {
  get attackHeld(){return mobile.attackHeld;},
  setAttackHeld(held:boolean){mobile.attackHeld=held;},
  get moveX() { return mobile.moveX; },
  get moveY() { return mobile.moveY; },
  get sprint() { return mobile.sprint; },
  setSprint(held: boolean) { mobile.sprint = held; },
  setMove(x: number, y: number) {
    const length = Math.hypot(x, y);
    if (length > 1) {
      mobile.moveX = x / length;
      mobile.moveY = y / length;
    } else {
      mobile.moveX = x;
      mobile.moveY = y;
    }
  },
  releaseMove() {
    mobile.moveX = 0;
    mobile.moveY = 0;
  },
  press(action: MobileAction) {
    mobile[action] = true;
  },
  consume(action: MobileAction) {
    const pressed = mobile[action];
    mobile[action] = false;
    return pressed;
  },
  reset() {
    mobile.attackHeld=false;
    mobile.moveX = 0;
    mobile.moveY = 0;
    mobile.attack = false;
    mobile.dash = false;
    mobile.jump=false;
    mobile.interact = false;
    mobile.healPotion=mobile.staminaPotion=false;
    mobile.sprint = false;
    mobile.skill1 = mobile.skill2 = mobile.skill3 = mobile.skill4 = false;
  },
};
