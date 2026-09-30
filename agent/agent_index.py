import uuid

from src.graph import create_study_buddy_graph


def main():
    """Interactive CLI runner for Study Buddy."""
    graph = create_study_buddy_graph()
    thread_id = str(uuid.uuid4())
    config = {
        "configurable": {
            "thread_id": thread_id,
        }
    }

    print("🤖 Study Buddy LangGraph initialized. (Type 'exit' or 'quit' to stop)\n")

    while True:
        try:
            user_message = input("You: ").strip()
            if not user_message:
                continue

            if user_message.lower() in ("exit", "quit"):
                print("Goodbye!")
                break

            response = graph.invoke(
                {"messages": [user_message]},
                config=config,
            )

            last_message = response.get("messages", [])[-1]
            content = getattr(last_message, "content", str(last_message))
            model_used = getattr(last_message, "response_metadata", {}).get("model_name")
            header = f"Assistant [{model_used}]" if model_used else "Assistant"
            print(f"\n{header}: {content}\n")

        except KeyboardInterrupt:
            print("\nSession ended.")
            break
        except Exception as e:  # noqa: BLE001
            print(f"\n[Error] {e}\n")


if __name__ == "__main__":
    main()
