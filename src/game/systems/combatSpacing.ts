import type Phaser from 'phaser';
import {isFirstPersonView} from '../presentation25d/plane';
import type {WeaponKind} from '../types';

/** An eye-level camera needs space between two bodies. Both melee damage and
 * enemy warnings use this same modest extension; artwork/physics stay aligned. */
export function meleeReach(scene:Phaser.Scene,reach:number,kind?:WeaponKind){
  return reach+(kind!=='bow'&&kind!=='crossbow'&&kind!=='staff'&&isFirstPersonView(scene)?24:0);
}
