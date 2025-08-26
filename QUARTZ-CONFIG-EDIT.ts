// Your quartz.config.ts file should look something like below.
// To switch to the 404 Did You Mean version, you need to edit your existing file:
//    1. Comment out (put // at the start of) the line "Plugin.NotFoundPage(),"
//    2. Underneath, add in the line "Plugin.CustomNotFoundPage(),"
// Leave everything else the same!
// To undo, just... undo those things.

import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

const config: QuartzConfig = {
  configuration: {...},
  plugins: {
    transformers: [...],
    filters: [...],
    emitters: [...
	  //Swap out default not found for custom with direction to corrected URL.
	  //Leave everything else the same!
	  
      //Plugin.NotFoundPage(),
	  Plugin.CustomNotFoundPage(),
    ],
  },
}

export default config
