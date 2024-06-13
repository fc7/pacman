'use strict';

import mongoose from 'mongoose';
import config from './config.js';

console.log("connecting to ", config.database.url);
await mongoose.connect(config.database.url, config.database.options).catch(err => console.log(err));

export default mongoose