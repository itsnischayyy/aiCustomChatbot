"use client";

import { useState, useEffect } from "react";
import { Mic, MicOff, Volume2, VolumeX, Send } from "lucide-react";

export function LocalChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recognitionInstance, setRecognitionInstance] = useState(null);
  const [instructionId, setInstructionId] = useState("default"); // Default instruction ID
  const [customInstruction, setCustomInstruction] = useState(""); // Custom instruction input
  const [instructions, setInstructions] = useState({}); // Store fetched instructions
  const [audioSrc, setAudioSrc] = useState(null); // Audio source for bot responses
  const [sessionId, setSessionId] = useState(null);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null); // For selected voice

  useEffect(() => {
    fetch(`${import.meta.env.VITE_BACKEND_URL}/instruction_sets`, {
      headers: {
        "ngrok-skip-browser-warning": "true", // Add the header with any value
      },
    })
      .then((response) => response.json())
      .then((data) => {
        setInstructions(data);
        if (Object.keys(data).length > 0) {
          setInstructionId(Object.keys(data)[0]);
        }
      })
      .catch((err) => console.error("Failed to fetch instruction sets:", err));
  }, []);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_BACKEND_URL}/new_session`, {
      headers: {
        "ngrok-skip-browser-warning": "true", // Add the header with any value
      },
    })
      .then((response) => response.json())
      .then((data) => {
        setSessionId(data.session_id);
        console.log("Session ID:", sessionId);
      })
      .catch((err) => console.error("Failed to fetch session ID:", err));
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const instance = new window.webkitSpeechRecognition();
      instance.continuous = false; // Stop after each result
      instance.interimResults = false; // Only final results

      let silenceTimer = null;

      instance.onresult = (event) => {
        clearTimeout(silenceTimer); // Clear inactivity timer
        const transcript = Array.from(event.results)
          .map((result) => result[0])
          .map((result) => result.transcript)
          .join("");
        setInput((prev) => transcript || prev); // Update input with transcript

        // Auto-stop recognition after 2 seconds of inactivity
        silenceTimer = setTimeout(() => {
          instance.stop();
          setIsListening(false);
          console.log(transcript.trim());
          if (transcript.trim()) {
            console.log(transcript.trim());
            sendMessage(transcript.trim()); // Submit the final transcript
          }
        }, 2000);
      };

      instance.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        instance.stop();
        setIsListening(false);
      };

      setRecognitionInstance(instance); // Store the instance globally
    }
  }, [sessionId]);

  useEffect(() => {
    if ("speechSynthesis" in window) {
      const voicesChanged = () => {
        setVoices(window.speechSynthesis.getVoices());
      };

      window.speechSynthesis.onvoiceschanged = voicesChanged;
      voicesChanged(); // Load voices immediately
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionInstance?.stop();
      setIsListening(false);
    } else {
      recognitionInstance?.start();
      setIsListening(true);
    }
  };

  const sendMessage = async (messageContent) => {
    if (!messageContent) return;

    const userMessage = { role: "user", content: messageContent };
    setMessages((prev) => [...prev, userMessage]);
    setInput(""); // Clear input field
    console.log("Session ID:", sessionId);

    try {
      setIsLoading(true);
      const selectedInstructionId = customInstruction || instructionId;
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify({
          session_id: sessionId,
          instruction_id: selectedInstructionId,
          question: userMessage.content,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        const botResponse = { role: "assistant", content: data.response };
        setMessages((prev) => [...prev, botResponse]);
        if (data.audio_url) {
          setAudioSrc(data.audio_url);
        }
        speak(botResponse.content);
      } else {
        console.error("Error from API:", data.error);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (audioSrc) {
      const audio = new Audio(audioSrc);
      audio
        .play()
        .catch((error) => console.error("Audio playback failed:", error));
    }
  }, [audioSrc]);

  const speak = (text) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    sendMessage(input.trim());
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-3xl font-bold text-center mb-8">
        Welcome to the Bot
      </h1>
      <div className="max-w-2xl mx-auto p-4 bg-white rounded-lg shadow">
        <div className="mb-4">
          <label
            htmlFor="instruction-select"
            className="block mb-2 font-semibold"
          >
            Select or Enter Instruction Set:
          </label>
          <div className="flex items-center gap-2">
            <select
              id="instruction-select"
              value={instructionId}
              onChange={(e) => {
                setInstructionId(e.target.value);
                setCustomInstruction("");
              }}
              className="p-2 border rounded flex-1"
            >
              {Object.entries(instructions).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder="Enter ID"
              className="p-2 border rounded w-28"
            />
          </div>
        </div>
        <div className="h-[400px] overflow-y-auto mb-4 p-4 border rounded bg-gray-50">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`mb-4 ${
                message.role === "user" ? "text-right" : "text-left"
              }`}
            >
              <div
                className={`inline-block p-2 rounded-lg ${
                  message.role === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-black"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="text-left">
              <div className="inline-block p-2 rounded-lg bg-gray-200">
                Typing...
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={toggleListening}
            className={`p-2 rounded-lg border ${
              isListening ? "bg-red-100" : "hover:bg-gray-100"
            }`}
          >
            {isListening ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={
              isSpeaking
                ? stopSpeaking
                : () => speak(messages[messages.length - 1]?.content)
            }
            disabled={!messages.length}
            className="p-2 rounded-lg border hover:bg-gray-100 disabled:opacity-50"
          >
            {isSpeaking ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 p-2 border rounded"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <div className="flex items-center gap-2">
          <label htmlFor="voice-select" className="sr-only">
            Select a voice
          </label>
          <select
            id="voice-select"
            className="p-2 border rounded flex-1 w-full mt-1"
            onChange={(e) =>
              setSelectedVoice(
                voices.find((voice) => voice.name === e.target.value)
              )
            }
            value={selectedVoice?.name || ""}
          >
            <option value="1" disabled>
              Select a voice
            </option>
            {voices.map((voice) => (
              <option key={voice.name} value={voice.name}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default LocalChat;
