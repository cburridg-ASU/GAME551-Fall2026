using System;
using UnityEngine;

public class MobileInputBridge : MonoBehaviour
{
    [Serializable]
    private struct MovementPayload
    {
        public float x;
        public float y;
    }

    public static Vector2 Movement { get; private set; }

    public void SetMovement(string payload)
    {
        if (string.IsNullOrEmpty(payload))
        {
            Movement = Vector2.zero;
            return;
        }

        try
        {
            var movement = JsonUtility.FromJson<MovementPayload>(payload);
            Movement = Vector2.ClampMagnitude(new Vector2(movement.x, movement.y), 1f);
        }
        catch (ArgumentException)
        {
            Movement = Vector2.zero;
        }
    }

    public void ReleaseMovement()
    {
        Movement = Vector2.zero;
    }
}
