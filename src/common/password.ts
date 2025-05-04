import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
const roundsOfHashing = 10;

@Injectable()
export class Password {
  async generate(data: string | Buffer) {
    try {
      return await bcrypt.hash(data, roundsOfHashing);
    } catch (error) {
      console.log('Password generation failed. Error:', error);
      throw new Error('Password generation failed.');
    }
  }

  async compare(data: string | Buffer, encrypted: string) {
    try {
      return await bcrypt.compare(data, encrypted);
    } catch (error) {
      console.log('Password comparison failed. Error:', error);
      throw new Error('Password comparison failed.');
    }
  }
}
