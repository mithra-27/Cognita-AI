import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  Lightbulb,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  User,
} from 'lucide-react';

import { api } from '../api/client';

import './AITutor.css';

/*
  The image is located in the same pages folder as AITutor.jsx.
*/
import tutorBrain from './cognita-tutor-brain.avif';


// =========================================================
// COGNITIVE DIMENSIONS
// =========================================================

const DIMENSIONS = [
  {
    key: 'anumana',
    name: 'Anumāna',
    skill: 'Logical / Inferential Reasoning',
    description:
      'Draw logical conclusions from available evidence.',
  },

  {
    key: 'arthapatti',
    name: 'Arthāpatti',
    skill: 'Abductive Reasoning',
    description:
      'Find the explanation that best accounts for the facts.',
  },

  {
    key: 'upamana',
    name: 'Upamāna',
    skill: 'Analogical Reasoning',
    description:
      'Identify meaningful relationships between examples.',
  },

  {
    key: 'pratyaksha',
    name: 'Pratyakṣa',
    skill: 'Observation / Visual Reasoning',
    description:
      'Reason carefully from observed information.',
  },

  {
    key: 'shabda',
    name: 'Śabda',
    skill: 'Reading / Interpretation',
    description:
      'Understand and interpret information from text.',
  },

  {
    key: 'anupalabdhi',
    name: 'Anupalabdhi',
    skill: 'Elimination / Contradiction Reasoning',
    description:
      'Reason from absence, contradiction, and elimination.',
  },
];


// =========================================================
// QUICK PROMPTS
// =========================================================

const QUICK_PROMPTS = [
  'Explain this reasoning skill to me.',
  'Give me a practice question.',
  'Show me a simple example.',
  'Give me a hint for improving my reasoning.',
];


// =========================================================
// INITIAL MESSAGE
// =========================================================

function getInitialMessage(dimension) {
  const selected = DIMENSIONS.find(
    (item) => item.key === dimension
  );

  return {
    id: `welcome-${dimension}-${Date.now()}`,

    role: 'assistant',

    content: selected
      ? `Hello! I’m your Cognita AI Tutor. Let’s work on ${selected.name} — ${selected.skill}. What would you like to practice?`
      : 'Hello! I’m your Cognita AI Tutor. Choose a reasoning dimension and I’ll help you understand concepts, work through examples, and practice your reasoning.',

    timestamp: new Date(),
  };
}


// =========================================================
// WELCOME COMPANION
// =========================================================

function TutorWelcome({ selectedDimension, onPrompt }) {
  return (
    <div className="tutor-welcome">

      <div className="tutor-welcome-glow" />

      <div className="tutor-brain-stage">

        <div className="brain-orbit brain-orbit-one" />
        <div className="brain-orbit brain-orbit-two" />

        <span className="brain-particle brain-particle-one" />
        <span className="brain-particle brain-particle-two" />
        <span className="brain-particle brain-particle-three" />

        <div className="brain-image-wrap">

          <img
            src={tutorBrain}
            alt="Cognita AI Tutor"
            className="tutor-brain-image"
          />

        </div>

      </div>


      <div className="tutor-welcome-content">

        <div className="tutor-welcome-label">

          <Sparkles size={14} />

          YOUR COGNITIVE COMPANION

        </div>


        <h2>
          Welcome to
          <span>
            Cognita Tutor
          </span>
        </h2>


        <p className="tutor-welcome-description">
          I’m here to help you think, understand,
          and reason better.
          <strong>
            Feel free to ask me anything.
          </strong>
        </p>


        <div className="tutor-welcome-skill">

          <BrainCircuit size={15} />

          <span>
            Currently exploring
          </span>

          <strong>
            {selectedDimension?.name}
          </strong>

        </div>


        <button
          type="button"
          className="tutor-welcome-prompt"
          onClick={() =>
            onPrompt(
              'Give me a simple example of this reasoning skill.'
            )
          }
        >

          <MessageCircle size={15} />

          Ask a question, request an example,
          or start with a practice problem.

        </button>

      </div>

    </div>
  );
}


// =========================================================
// MAIN COMPONENT
// =========================================================

export default function AITutor() {

  const [
    dimension,
    setDimension,
  ] = useState('anumana');


  const [
    messages,
    setMessages,
  ] = useState(() => [
    getInitialMessage('anumana'),
  ]);


  const [
    input,
    setInput,
  ] = useState('');


  const [
    loading,
    setLoading,
  ] = useState(false);


  const [
    error,
    setError,
  ] = useState('');


  const messagesEndRef =
    useRef(null);


  // =======================================================
  // SELECTED DIMENSION
  // =======================================================

  const selectedDimension =
    useMemo(
      () =>
        DIMENSIONS.find(
          (item) =>
            item.key === dimension
        ),
      [dimension]
    );


  // =======================================================
  // AUTO SCROLL
  // =======================================================

  useEffect(() => {

    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });

  }, [
    messages,
    loading,
  ]);


  // =======================================================
  // CHANGE DIMENSION
  // =======================================================

  const changeDimension = (nextDimension) => {

    setDimension(nextDimension);

    setMessages([
      getInitialMessage(nextDimension),
    ]);

    setInput('');
    setError('');
  };


  const handleDimensionChange = (event) => {

    changeDimension(
      event.target.value
    );

  };


  // =======================================================
  // SEND MESSAGE
  // =======================================================

  const sendMessage = async (
    messageOverride = null
  ) => {

    const message = (
      messageOverride ??
      input
    ).trim();


    if (
      !message ||
      loading
    ) {
      return;
    }


    setError('');


    // -----------------------------------------------------
    // USER MESSAGE
    // -----------------------------------------------------

    const userMessage = {
      id: `user-${Date.now()}`,

      role: 'user',

      content: message,

      timestamp: new Date(),
    };


    // -----------------------------------------------------
    // CONVERSATION HISTORY
    // -----------------------------------------------------

    const conversationForApi = [
      ...messages,
      userMessage,
    ]
      .filter(
        (item) =>
          item.role === 'user' ||
          item.role === 'assistant'
      )
      .slice(-8)
      .map(
        (item) => ({
          role: item.role,
          content: item.content,
        })
      );


    // -----------------------------------------------------
    // UPDATE UI
    // -----------------------------------------------------

    setMessages(
      (current) => [
        ...current,
        userMessage,
      ]
    );


    setInput('');
    setLoading(true);


    // =====================================================
    // API CALL
    // =====================================================

    try {

      const response =
        await api.chatWithTutor({
          message,

          skill:
            dimension,

          history:
            conversationForApi,
        });


      // ---------------------------------------------------
      // NORMALIZE RESPONSE
      // ---------------------------------------------------

      const data =
        response?.data ??
        response;


      const answer =
        data?.answer ||
        'I could not generate a response right now. Please try again.';


      // ---------------------------------------------------
      // ASSISTANT MESSAGE
      // ---------------------------------------------------

      const assistantMessage = {

        id:
          `assistant-${Date.now()}`,

        role:
          'assistant',

        content:
          answer,

        timestamp:
          new Date(),

        source:
          data?.sources ??
          data?.source ??
          null,
      };


      setMessages(
        (current) => [
          ...current,
          assistantMessage,
        ]
      );


    } catch (err) {

      console.error(
        '[AI Tutor] Failed to send message:',
        err
      );


      setError(
        err?.message ||
        'Unable to connect to the AI Tutor.'
      );


    } finally {

      setLoading(false);

    }
  };


  // =======================================================
  // FORM SUBMIT
  // =======================================================

  const handleSubmit = (event) => {

    event.preventDefault();

    sendMessage();

  };


  // =======================================================
  // NEW CHAT
  // =======================================================

  const clearConversation = () => {

    setMessages([
      getInitialMessage(
        dimension
      ),
    ]);

    setInput('');
    setError('');

  };


  // =======================================================
  // RENDER
  // =======================================================

  return (

    <div className="ai-tutor-page">


      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <section className="ai-tutor-header">

        <div>

          <div className="ai-tutor-eyebrow">

            <Sparkles size={15} />

            COGNITA AI

          </div>


          <h1>
            AI Tutor
          </h1>


          <p>
            Learn how to reason, understand your
            mistakes, and strengthen your cognitive
            skills through guided practice.
          </p>

        </div>


        <div className="ai-tutor-status">

          <span className="status-dot" />

          AI Tutor Online

        </div>

      </section>


      {/* ================================================= */}
      {/* MAIN LAYOUT */}
      {/* ================================================= */}

      <section className="ai-tutor-layout">


        {/* =============================================== */}
        {/* LEFT — DIMENSIONS */}
        {/* =============================================== */}

        <aside className="ai-tutor-sidebar">


          <div className="sidebar-heading">

            <BrainCircuit size={18} />

            <div>

              <strong>
                Reasoning Skills
              </strong>

              <span>
                Choose a cognitive dimension
              </span>

            </div>

          </div>


          <div className="dimension-list">

            {DIMENSIONS.map(
              (item, index) => {

                const active =
                  item.key === dimension;


                return (

                  <button
                    key={item.key}
                    type="button"
                    className={
                      `dimension-item ${
                        active
                          ? 'active'
                          : ''
                      }`
                    }
                    onClick={() =>
                      changeDimension(
                        item.key
                      )
                    }
                  >

                    <span className="dimension-number">

                      {index + 1}

                    </span>


                    <span className="dimension-content">

                      <strong>
                        {item.name}
                      </strong>

                      <small>
                        {item.skill}
                      </small>

                    </span>


                    {active && (

                      <CheckCircle2
                        size={16}
                      />

                    )}

                  </button>

                );

              }
            )}

          </div>


          <div className="tutor-tip">

            <Lightbulb size={18} />

            <div>

              <strong>
                Tutor tip
              </strong>

              <p>
                Ask for a hint before asking
                for the complete answer.
              </p>

            </div>

          </div>

        </aside>


        {/* =============================================== */}
        {/* CENTER — CHAT */}
        {/* =============================================== */}

        <main className="ai-tutor-chat">


          {/* ============================================= */}
          {/* CHAT HEADER */}
          {/* ============================================= */}

          <div className="chat-header">

            <div className="chat-avatar">

              <Bot size={22} />

            </div>


            <div className="chat-title">

              <strong>
                Cognita Tutor
              </strong>

              <span>

                {selectedDimension?.name}

                {' · '}

                {selectedDimension?.skill}

              </span>

            </div>


            <button
              type="button"
              className="clear-chat-button"
              onClick={
                clearConversation
              }
            >
              New chat
            </button>

          </div>


          {/* ============================================= */}
          {/* WELCOME COMPANION */}
          {/* ============================================= */}

          {messages.length === 1 &&
            messages[0]?.role === 'assistant' && (

              <TutorWelcome
                selectedDimension={
                  selectedDimension
                }
                onPrompt={
                  sendMessage
                }
              />

            )}


          {/* ============================================= */}
          {/* DIMENSION SELECTOR */}
          {/* ============================================= */}

          <div className="chat-controls">

            <label>
              Cognitive Dimension
            </label>


            <select
              value={dimension}
              onChange={
                handleDimensionChange
              }
            >

              {DIMENSIONS.map(
                (item) => (

                  <option
                    key={item.key}
                    value={item.key}
                  >
                    {item.name} — {item.skill}
                  </option>

                )
              )}

            </select>

          </div>


          {/* ============================================= */}
          {/* CHAT MESSAGES */}
          {/* ============================================= */}

          <div className="chat-messages">

            {messages.map(
              (message) => {

                const isUser =
                  message.role === 'user';


                return (

                  <div
                    key={message.id}
                    className={
                      `chat-message-row ${
                        isUser
                          ? 'user-row'
                          : 'assistant-row'
                      }`
                    }
                  >


                    {!isUser && (

                      <div className="message-avatar tutor-avatar">

                        <Bot size={17} />

                      </div>

                    )}


                    <div
                      className={
                        `message-bubble ${
                          isUser
                            ? 'user-bubble'
                            : 'assistant-bubble'
                        }`
                      }
                    >

                      <div className="message-text">

                        {message.content}

                      </div>


                      <span className="message-time">

                        {message.timestamp
                          ?.toLocaleTimeString(
                            [],
                            {
                              hour:
                                '2-digit',

                              minute:
                                '2-digit',
                            }
                          )}

                      </span>

                    </div>


                    {isUser && (

                      <div className="message-avatar user-avatar">

                        <User size={17} />

                      </div>

                    )}

                  </div>

                );

              }
            )}


            {/* =========================================== */}
            {/* TYPING INDICATOR */}
            {/* =========================================== */}

            {loading && (

              <div className="chat-message-row assistant-row">

                <div className="message-avatar tutor-avatar">

                  <Bot size={17} />

                </div>


                <div className="message-bubble assistant-bubble typing-bubble">

                  <Loader2
                    size={17}
                    className="typing-spinner"
                  />

                  <span>
                    Thinking...
                  </span>

                </div>

              </div>

            )}


            <div
              ref={messagesEndRef}
            />

          </div>


          {/* ============================================= */}
          {/* ERROR */}
          {/* ============================================= */}

          {error && (

            <div className="tutor-error">

              {error}

            </div>

          )}


          {/* ============================================= */}
          {/* QUICK PROMPTS */}
          {/* ============================================= */}

          <div className="quick-prompts">

            {QUICK_PROMPTS.map(
              (prompt) => (

                <button
                  key={prompt}
                  type="button"
                  onClick={() =>
                    sendMessage(
                      prompt
                    )
                  }
                  disabled={loading}
                >
                  {prompt}
                </button>

              )
            )}

          </div>


          {/* ============================================= */}
          {/* INPUT */}
          {/* ============================================= */}

          <form
            className="tutor-input-area"
            onSubmit={handleSubmit}
          >

            <div className="input-icon">

              <MessageCircle
                size={18}
              />

            </div>


            <input
              type="text"
              value={input}
              onChange={(event) =>
                setInput(
                  event.target.value
                )
              }
              placeholder={
                `Ask about ${
                  selectedDimension?.name ||
                  'reasoning'
                }...`
              }
              disabled={loading}
              maxLength={2000}
            />


            <button
              type="submit"
              disabled={
                loading ||
                !input.trim()
              }
              aria-label="Send message"
            >

              {loading ? (

                <Loader2
                  size={18}
                  className="typing-spinner"
                />

              ) : (

                <Send size={18} />

              )}

            </button>

          </form>


          {/* ============================================= */}
          {/* DISCLAIMER */}
          {/* ============================================= */}

          <div className="chat-disclaimer">

            Cognita Tutor provides educational
            reasoning guidance and is not a
            psychological or medical assessment.

          </div>

        </main>


        {/* =============================================== */}
        {/* RIGHT — CURRENT SKILL */}
        {/* =============================================== */}

        <aside className="tutor-info-panel">


          <div className="info-card skill-card">

            <div className="info-card-icon">

              <BrainCircuit size={21} />

            </div>


            <span className="info-label">
              CURRENT SKILL
            </span>


            <h2>
              {selectedDimension?.name}
            </h2>


            <p>
              {selectedDimension?.description}
            </p>


            <div className="skill-pill">

              {selectedDimension?.skill}

            </div>

          </div>


          <div className="info-card">

            <div className="info-card-title">

              <Lightbulb size={18} />

              How to use the tutor

            </div>


            <ol>

              <li>
                Choose a reasoning dimension.
              </li>

              <li>
                Ask for an explanation or
                example.
              </li>

              <li>
                Request a practice question.
              </li>

              <li>
                Ask for a hint when stuck.
              </li>

              <li>
                Review the reasoning behind
                the answer.
              </li>

            </ol>

          </div>


          <div className="info-card tutor-features">

            <div className="info-card-title">

              <Sparkles size={18} />

              Tutor capabilities

            </div>


            <div className="feature-row">

              <span>
                RAG-supported explanations
              </span>

              <CheckCircle2 size={16} />

            </div>


            <div className="feature-row">

              <span>
                Reasoning examples
              </span>

              <CheckCircle2 size={16} />

            </div>


            <div className="feature-row">

              <span>
                Guided practice
              </span>

              <CheckCircle2 size={16} />

            </div>


            <div className="feature-row">

              <span>
                Mistake explanation
              </span>

              <CheckCircle2 size={16} />

            </div>

          </div>

        </aside>

      </section>

    </div>
  );
}