# Trip App
web app version of Trip Planner

Start the Docker daemon first

```bash
open -a Docker
```
To start the app

```bash
npm run dev
``` 

point browser to 

http://localhost:3000/


## Issues

- rapid fire flashing updates on trip json after several UI updates. I think it is hitting the external APIs. Should start by disabling those first. I may be drop and drag firing multiple save events.
- add a layer between the UI and the trip jason to translate hour and mins widget into minutes in the data store.
- Trip titles are mangled.
- No hotel or activity confirmations
- Start Time (wake up time should be changed) will not update in the UI. If the json has an empty string.