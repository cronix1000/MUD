```mermaid
flowchart TB
  A[Command Send] --> B{Target Intet}
  1[]
  B -->|Yes| C[Continue] 
  B -->|No| D[Stop]
  C -->E[AI]
  E -->F[Check if single hit]
```

Type Kill
Get Targeting Intent
Candiatates will be empty
First Pass:
  Check query tokens
  if they have a max range update the shape to use there range
  if not do shape around [Physical]
  Update matching targets with [EntityResolver]
  remove the enemies with stat components without health
Second Pass with targets:
  If no targets send failed
  If 1 target or there is more then targeting index [AOE] doesnt matter if target
    Create a skill intent 
  If Multiple Targets Send confirmation message of multiple targets
  Prompt user to type attack enemy {1}, {2}, {3}, etc...

Skill Intent Consume
Check for windup for skill
If windup subtract from timeleft
  when no windup left execute
If no windup lookup skill 
  Find cooldown component
  if no Cooldown component
    error
  if cooldown component

  if skill is on cooldown 
    possibly remove intent {need to decide still}
  else
    if windup time is greater then 0
      create windup
    if no windup cast 

Execute skill
find lua related skill
prepare/create skill context for lua from max power
execute on use with context
if execute works 
  get lua table and create
  create combat intent
else 
  error


Consume Combat Skill Intent
if type of combat intent is attack
check for crit
send all combat information to process attack

Process Attack
Get enemy stats
Get 
