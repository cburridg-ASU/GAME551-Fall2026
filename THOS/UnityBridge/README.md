# THOS mobile input bridge

1. Copy `MobileInputBridge.cs` into the Unity project under `Assets/Scripts`.
2. Create an active GameObject named `MobileInputBridge` in the first loaded scene.
3. Add the `MobileInputBridge` component to that GameObject.
4. In the player movement script, read `MobileInputBridge.Movement` and use it as the movement vector when it is non-zero. For example:

```csharp
var mobileMovement = MobileInputBridge.Movement;
var horizontal = mobileMovement.x != 0f ? mobileMovement.x : Input.GetAxisRaw("Horizontal");
var vertical = mobileMovement.y != 0f ? mobileMovement.y : Input.GetAxisRaw("Vertical");
```

5. Export a new WebGL build into this `THOS` folder.

The updated `THOS/index.html` receives `thos-movement` messages from the portal and calls `MobileInputBridge.SetMovement` through the Unity WebGL instance.
