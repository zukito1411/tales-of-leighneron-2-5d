import type Phaser from 'phaser';

/** A new atlas origin/scale changes the body's local registration, not its
 * physical travel. Shift the history by that registration delta so Arcade's
 * postUpdate cannot add it to the actor's world position a second time.
 * Retain real movement already accumulated in this physics step. NPCs use
 * velocity-driven Arcade motion, rather than directControl. */
export function syncActorBodyFrame(body:Phaser.Physics.Arcade.Body){
 const x=body.position.x,y=body.position.y;
 body.updateFromGameObject();
 const dx=body.position.x-x,dy=body.position.y-y;
 body.prev.x+=dx;body.prev.y+=dy;
 body.prevFrame.x+=dx;body.prevFrame.y+=dy;
}
