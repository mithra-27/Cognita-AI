import { useEffect, useMemo, useState } from 'react';

import {
  Search,
  BookOpen,
  Brain,
  Filter,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  Eye,
  Lightbulb,
  Database,
  Sparkles,
  X,
  Image as ImageIcon,
} from 'lucide-react';

import { api, API_URL } from '../api/client';
import './KnowledgeBase.css';


/* =========================================================
   KNOWLEDGE BASE CONFIGURATION
   ========================================================= */

const SKILLS = [
  {
    value: 'all',
    label: 'All Dimensions',
  },
  {
    value: 'anumana',
    label: 'Anumāna',
  },
  {
    value: 'arthapatti',
    label: 'Arthāpatti',
  },
  {
    value: 'upamana',
    label: 'Upamāna',
  },
  {
    value: 'pratyaksha',
    label: 'Pratyakṣa',
  },
  {
    value: 'shabda',
    label: 'Śabda',
  },
  {
    value: 'anupalabdhi',
    label: 'Anupalabdhi',
  },
];

const DIFFICULTIES = [
  'all',
  'easy',
  'medium',
  'hard',
];

const STORAGE_KEY = 'cognita_knowledge_bookmarks';


/* =========================================================
   SEARCH NORMALIZATION
   ========================================================= */

function normalizeSearchTerm(value) {
  if (!value) return '';

  return String(value)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}


/* =========================================================
   DIMENSION ALIASES
   ========================================================= */

const SEARCH_ALIASES = {
  anumana: 'anumana',
  'logical reasoning': 'anumana',
  'inferential reasoning': 'anumana',
  inference: 'anumana',
  logic: 'anumana',

  arthapatti: 'arthapatti',
  'abductive reasoning': 'arthapatti',
  abduction: 'arthapatti',
  'problem solving': 'arthapatti',

  upamana: 'upamana',
  'analogical reasoning': 'upamana',
  analogy: 'upamana',

  pratyaksha: 'pratyaksha',
  'visual reasoning': 'pratyaksha',
  visual: 'pratyaksha',
  observation: 'pratyaksha',

  shabda: 'shabda',
  sabda: 'shabda',
  sabdha: 'shabda',
  shabdha: 'shabda',
  'reading comprehension': 'shabda',
  comprehension: 'shabda',
  interpretation: 'shabda',

  anupalabdhi: 'anupalabdhi',
  'absence reasoning': 'anupalabdhi',
  contradiction: 'anupalabdhi',
  'elimination reasoning': 'anupalabdhi',
  elimination: 'anupalabdhi',
};


/* =========================================================
   DIMENSION DETECTION
   ========================================================= */

function detectSkillFromQuery(value) {
  const query = normalizeSearchTerm(value);

  if (!query) return null;

  if (SEARCH_ALIASES[query]) {
    return SEARCH_ALIASES[query];
  }

  const aliases = Object.keys(SEARCH_ALIASES)
    .sort((a, b) => b.length - a.length);

  for (const alias of aliases) {
    if (
      query.includes(
        normalizeSearchTerm(alias)
      )
    ) {
      return SEARCH_ALIASES[alias];
    }
  }

  return null;
}


/* =========================================================
   DISPLAY HELPERS
   ========================================================= */

function getSkillLabel(skill) {
  const normalized = normalizeSearchTerm(skill);

  const labels = {
    anumana: 'Anumāna',
    arthapatti: 'Arthāpatti',
    upamana: 'Upamāna',
    pratyaksha: 'Pratyakṣa',
    shabda: 'Śabda',
    anupalabdhi: 'Anupalabdhi',
  };

  return labels[normalized] || skill || 'Reasoning';
}


function getDifficultyClass(difficulty) {
  const value = String(
    difficulty || ''
  )
    .toLowerCase()
    .trim();

  if (value === 'easy') {
    return 'difficulty-easy';
  }

  if (
    value === 'hard'
  ) {
    return 'difficulty-hard';
  }

  return 'difficulty-medium';
}


function getResultId(result, index) {
  return (
    result?.id ||
    result?.question_id ||
    result?.metadata?.id ||
    `knowledge-${index}`
  );
}


/* =========================================================
   RESULT NORMALIZATION
   ========================================================= */

function normalizeResult(
  result,
  index
) {
  const metadata =
    result?.metadata || {};

  const question =
    result?.question ||
    result?.text ||
    result?.content ||
    result?.document ||
    metadata?.question ||
    '';

  const title =
    result?.title ||
    metadata?.title ||
    `Reasoning Example ${index + 1}`;

  const options =
    Array.isArray(result?.options)
      ? result.options
      : Array.isArray(metadata?.options)
        ? metadata.options
        : [];

  const skill =
    result?.skill ||
    metadata?.skill ||
    '';

  return {
    id: getResultId(
      result,
      index
    ),

    title,

    question,

    options,

    skill,

    skillName:
      result?.skill_name ||
      metadata?.skill_name ||
      getSkillLabel(skill),

    difficulty:
      result?.difficulty ||
      metadata?.difficulty ||
      'medium',

    dataset:
      result?.dataset ||
      metadata?.dataset ||
      metadata?.source ||
      'Cognitive Reasoning Dataset',

    source:
      result?.source ||
      metadata?.source ||
      '',

    questionType:
      result?.question_type ||
      metadata?.question_type ||
      'reasoning',

    image:
      result?.image ||
      metadata?.image ||
      null,
  };
}


/* =========================================================
   RESPONSE EXTRACTION
   ========================================================= */

function extractResults(response) {
  if (!response) {
    return [];
  }

  const data =
    response?.data ??
    response;

  if (Array.isArray(data)) {
    return data;
  }

  if (
    Array.isArray(
      data?.results
    )
  ) {
    return data.results;
  }

  if (
    Array.isArray(
      data?.items
    )
  ) {
    return data.items;
  }

  if (
    Array.isArray(
      data?.resources
    )
  ) {
    return data.resources;
  }

  if (
    Array.isArray(
      response?.results
    )
  ) {
    return response.results;
  }

  return [];
}


/* =========================================================
   COMPONENT
   ========================================================= */

export default function KnowledgeBase() {
  const [query, setQuery] =
    useState('');

  const [submittedQuery, setSubmittedQuery] =
    useState('');

  const [skill, setSkill] =
    useState('all');

  const [difficulty, setDifficulty] =
    useState('all');

  const [results, setResults] =
    useState([]);

  const [selectedResult, setSelectedResult] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [initialLoading, setInitialLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [bookmarks, setBookmarks] =
    useState(() => {
      try {
        const stored =
          localStorage.getItem(
            STORAGE_KEY
          );

        return stored
          ? JSON.parse(stored)
          : [];
      } catch {
        return [];
      }
    });

  const [showFilters, setShowFilters] =
    useState(false);

  const [showBookmarksOnly, setShowBookmarksOnly] =
    useState(false);


  /* =======================================================
     BOOKMARK STORAGE
     ======================================================= */

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(bookmarks)
      );
    } catch {
      // Ignore localStorage errors.
    }
  }, [bookmarks]);


  const isBookmarked = (id) =>
    bookmarks.includes(id);


  const toggleBookmark = (id) => {
    setBookmarks(
      (current) => {
        if (
          current.includes(id)
        ) {
          return current.filter(
            (item) =>
              item !== id
          );
        }

        return [
          ...current,
          id,
        ];
      }
    );
  };


  /* =======================================================
     SEARCH
     ======================================================= */

  const performSearch = async ({
    searchQuery = query,
    selectedSkill = skill,
    selectedDifficulty = difficulty,
    initial = false,
  } = {}) => {
    const trimmedQuery =
      String(
        searchQuery || ''
      ).trim();

    if (!trimmedQuery) {
      setResults([]);
      setSelectedResult(null);
      setSubmittedQuery('');
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    if (initial) {
      setInitialLoading(true);
    }

    try {
      const params =
        new URLSearchParams();

      params.set(
        'q',
        trimmedQuery
      );

      /*
       * Important:
       *
       * If the user types:
       *     sabdha
       *
       * detect it as:
       *     shabda
       *
       * and send the explicit skill to the backend.
       *
       * This gives us two layers of protection:
       *
       * Frontend:
       *     sabdha -> shabda
       *
       * Backend:
       *     strict actual-metadata filtering
       */

      const detectedSkill =
        detectSkillFromQuery(
          trimmedQuery
        );

      let effectiveSkill =
        selectedSkill &&
        selectedSkill !== 'all'
          ? selectedSkill
          : null;

      if (
        !effectiveSkill &&
        detectedSkill
      ) {
        effectiveSkill =
          detectedSkill;
      }

      if (effectiveSkill) {
        params.set(
          'skill',
          effectiveSkill
        );
      }

      if (
        selectedDifficulty &&
        selectedDifficulty !== 'all'
      ) {
        params.set(
          'difficulty',
          selectedDifficulty
        );
      }

      params.set(
        'limit',
        '20'
      );

      const response =
        await api.searchKnowledge(
          params.toString()
        );

      const normalized =
        extractResults(response)
          .map(
            normalizeResult
          );

      setResults(
        normalized
      );

      setSubmittedQuery(
        trimmedQuery
      );

      if (
        normalized.length > 0
      ) {
        setSelectedResult(
          normalized[0]
        );
      } else {
        setSelectedResult(
          null
        );
      }

    } catch (err) {
      console.error(
        'Knowledge Base search failed:',
        err
      );

      setResults([]);
      setSelectedResult(
        null
      );

      setError(
        err?.message ||
          'Unable to load knowledge resources.'
      );

    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };


  /* =======================================================
     SEARCH SUBMIT
     ======================================================= */

  const handleSearch = (
    event
  ) => {
    event?.preventDefault();

    performSearch({
      searchQuery: query,
      selectedSkill: skill,
      selectedDifficulty:
        difficulty,
    });
  };


  /* =======================================================
     SKILL FILTER
     ======================================================= */

  const handleSkillChange = (
    value
  ) => {
    setSkill(value);

    if (query.trim()) {
      performSearch({
        searchQuery: query,
        selectedSkill: value,
        selectedDifficulty:
          difficulty,
      });
    }
  };


  /* =======================================================
     DIFFICULTY FILTER
     ======================================================= */

  const handleDifficultyChange = (
    value
  ) => {
    setDifficulty(value);

    if (query.trim()) {
      performSearch({
        searchQuery: query,
        selectedSkill: skill,
        selectedDifficulty:
          value,
      });
    }
  };


  /* =======================================================
     CLEAR
     ======================================================= */

  const clearSearch = () => {
    setQuery('');
    setSubmittedQuery('');
    setResults([]);
    setSelectedResult(null);
    setError('');
  };


  /* =======================================================
     FILTERED RESULTS
     ======================================================= */

  const filteredResults =
    useMemo(() => {
      let items =
        results;

      if (
        showBookmarksOnly
      ) {
        items =
          items.filter(
            (item) =>
              bookmarks.includes(
                item.id
              )
          );
      }

      return items;
    }, [
      results,
      showBookmarksOnly,
      bookmarks,
    ]);


  /* =======================================================
     IMAGE URL
     ======================================================= */

  const imageUrl = (
    image
  ) => {
    if (!image) {
      return '';
    }

    return `${API_URL}/api/assessment/image/${encodeURIComponent(
      image
    )}`;
  };


  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="knowledge-page">

      <div className="knowledge-shell">

        {/* =================================================
            HERO
        ================================================= */}

        <section className="knowledge-hero">

          <div className="knowledge-hero-content">

            <div className="knowledge-eyebrow">

              <span className="knowledge-eyebrow-icon">
                <Brain size={15} />
              </span>

              COGNITIVE KNOWLEDGE BASE

            </div>

            <h1>
              Explore the
              <span>
                Reasoning Knowledge Base
              </span>
            </h1>

            <p>
              Discover reasoning examples,
              questions, and cognitive resources
              organized across the six
              Mīmāṃsā-inspired reasoning dimensions
              used by Cognita AI.
            </p>

            <div className="knowledge-source-note">
              <Database size={14} />

              <span>
                Retrieval-supported cognitive
                knowledge layer
              </span>
            </div>

          </div>


          <div
            className="knowledge-hero-orbit"
            aria-hidden="true"
          >

            <div className="orbit-glow" />

            <div className="orbit-ring orbit-ring-one" />

            <div className="orbit-ring orbit-ring-two" />

            <div className="orbit-ring orbit-ring-three" />

            <div className="orbit-core">

              <Brain size={32} />

              <span>
                Cognita
              </span>

            </div>

            <span className="orbit-dot dot-one" />
            <span className="orbit-dot dot-two" />
            <span className="orbit-dot dot-three" />

            <div className="orbit-label orbit-label-one">
              <Sparkles size={13} />

              <span>
                Reasoning
                <small>
                  Explore
                </small>
              </span>
            </div>

            <div className="orbit-label orbit-label-two">
              <Lightbulb size={13} />

              <span>
                Knowledge
                <small>
                  Discover
                </small>
              </span>
            </div>

          </div>

        </section>


        {/* =================================================
            SEARCH
        ================================================= */}

        <section className="knowledge-search-section">

          <form
            className="knowledge-search-form"
            onSubmit={handleSearch}
          >

            <div className="knowledge-search-input">

              <Search size={20} />

              <input
                value={query}
                onChange={(event) =>
                  setQuery(
                    event.target.value
                  )
                }
                placeholder="Search concepts, questions, or reasoning examples..."
                aria-label="Search knowledge base"
              />

              {query && (
                <button
                  type="button"
                  className="knowledge-clear-button"
                  onClick={
                    clearSearch
                  }
                  aria-label="Clear search"
                >
                  <X size={17} />
                </button>
              )}

            </div>


            <button
              type="submit"
              className="knowledge-search-button"
              disabled={
                loading ||
                !query.trim()
              }
            >
              <Search size={17} />
              Search
            </button>

          </form>


          <div className="knowledge-toolbar">

            <button
              type="button"
              className={`filter-toggle ${
                showFilters
                  ? 'filter-toggle-active'
                  : ''
              }`}
              onClick={() =>
                setShowFilters(
                  (value) =>
                    !value
                )
              }
            >
              <Filter size={15} />
              Filters
            </button>


            <button
              type="button"
              className={`bookmark-toggle ${
                showBookmarksOnly
                  ? 'bookmark-toggle-active'
                  : ''
              }`}
              onClick={() =>
                setShowBookmarksOnly(
                  (value) =>
                    !value
                )
              }
            >

              {showBookmarksOnly ? (
                <BookmarkCheck
                  size={15}
                />
              ) : (
                <Bookmark
                  size={15}
                />
              )}

              Saved Resources

              <span>
                {bookmarks.length}
              </span>

            </button>


            {submittedQuery && (
              <div className="knowledge-query-label">

                Results for

                <strong>
                  "{submittedQuery}"
                </strong>

              </div>
            )}

          </div>


          {/* FILTER PANEL */}

          {showFilters && (
            <div className="knowledge-filter-panel">

              <div className="filter-group">

                <div className="filter-label">
                  Reasoning Dimension
                </div>

                <div className="filter-options">

                  {SKILLS.map(
                    (item) => (
                      <button
                        key={
                          item.value
                        }
                        type="button"
                        className={
                          skill ===
                          item.value
                            ? 'filter-chip active'
                            : 'filter-chip'
                        }
                        onClick={() =>
                          handleSkillChange(
                            item.value
                          )
                        }
                      >
                        {item.label}
                      </button>
                    )
                  )}

                </div>

              </div>


              <div className="filter-group">

                <div className="filter-label">
                  Difficulty
                </div>

                <div className="filter-options">

                  {DIFFICULTIES.map(
                    (item) => (
                      <button
                        key={item}
                        type="button"
                        className={
                          difficulty ===
                          item
                            ? 'filter-chip active'
                            : 'filter-chip'
                        }
                        onClick={() =>
                          handleDifficultyChange(
                            item
                          )
                        }
                      >
                        {item === 'all'
                          ? 'All'
                          : item
                              .charAt(0)
                              .toUpperCase() +
                            item.slice(1)}
                      </button>
                    )
                  )}

                </div>

              </div>

            </div>
          )}

        </section>


        {/* =================================================
            MAIN CONTENT
        ================================================= */}

        <section className="knowledge-content">

          {/* RESULTS */}

          <div className="knowledge-results-column">

            <div className="knowledge-section-heading">

              <div>

                <span className="section-kicker">
                  DISCOVER
                </span>

                <h2>
                  Reasoning Resources
                </h2>

              </div>

              {filteredResults.length > 0 && (
                <span className="result-count">
                  {filteredResults.length}{' '}
                  resources
                </span>
              )}

            </div>


            {/* LOADING */}

            {initialLoading ||
            loading ? (
              <div className="knowledge-loading">

                <div className="loading-orbit">
                  <span />
                  <span />
                  <span />
                </div>

                <h3>
                  Exploring the knowledge layer
                </h3>

                <p>
                  Finding relevant reasoning
                  resources for your search...
                </p>

              </div>
            ) : error ? (

              /* ERROR */

              <div className="knowledge-empty error-state">

                <div className="empty-icon">
                  <Database size={28} />
                </div>

                <h3>
                  Knowledge Base unavailable
                </h3>

                <p>
                  {error}
                </p>

                <button
                  type="button"
                  className="knowledge-retry-button"
                  onClick={() =>
                    performSearch()
                  }
                >
                  Try Again
                </button>

              </div>

            ) : filteredResults.length === 0 ? (

              /* EMPTY */

              <div className="knowledge-empty">

                <div className="empty-icon">
                  <BookOpen size={29} />
                </div>

                <h3>
                  {showBookmarksOnly
                    ? 'No saved resources'
                    : submittedQuery
                      ? 'No matching resources'
                      : 'Start exploring the knowledge base'}
                </h3>

                <p>
                  {showBookmarksOnly
                    ? 'Save useful reasoning resources with the bookmark icon to build your personal collection.'
                    : submittedQuery
                      ? 'Try a different search phrase or adjust the reasoning dimension and difficulty filters.'
                      : 'Search for a reasoning concept, question, or example to explore Cognita AI’s cognitive knowledge base.'}
                </p>

                {!submittedQuery &&
                  !showBookmarksOnly && (
                    <div className="suggestion-row">

                      {[
                        'logical reasoning',
                        'analogy',
                        'reading comprehension',
                        'visual reasoning',
                      ].map(
                        (suggestion) => (
                          <button
                            key={
                              suggestion
                            }
                            type="button"
                            onClick={() => {
                              setQuery(
                                suggestion
                              );

                              performSearch({
                                searchQuery:
                                  suggestion,
                                selectedSkill:
                                  skill,
                                selectedDifficulty:
                                  difficulty,
                              });
                            }}
                          >
                            {suggestion}
                          </button>
                        )
                      )}

                    </div>
                  )}

              </div>

            ) : (

              /* RESULTS */

              <div className="knowledge-result-list">

                {filteredResults.map(
                  (result, index) => {

                    const active =
                      selectedResult?.id ===
                      result.id;

                    const saved =
                      isBookmarked(
                        result.id
                      );

                    return (
                      <article
                        key={
                          result.id
                        }
                        className={`knowledge-result-card ${
                          active
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() =>
                          setSelectedResult(
                            result
                          )
                        }
                        tabIndex={0}
                        role="button"
                        onKeyDown={(
                          event
                        ) => {
                          if (
                            event.key ===
                            'Enter'
                          ) {
                            setSelectedResult(
                              result
                            );
                          }
                        }}
                      >

                        <div className="result-number">
                          {String(
                            index + 1
                          ).padStart(
                            2,
                            '0'
                          )}
                        </div>


                        <div className="result-main">

                          <div className="result-meta">

                            <span className="skill-badge">
                              {getSkillLabel(
                                result.skillName ||
                                  result.skill
                              )}
                            </span>

                            <span
                              className={`difficulty-badge ${getDifficultyClass(
                                result.difficulty
                              )}`}
                            >
                              {String(
                                result.difficulty ||
                                  'medium'
                              )
                                .charAt(0)
                                .toUpperCase() +
                                String(
                                  result.difficulty ||
                                    'medium'
                                ).slice(1)}
                            </span>

                          </div>


                          <h3>
                            {result.title}
                          </h3>

                          <p>
                            {result.question}
                          </p>


                          <div className="result-footer">

                            <span>
                              <Database
                                size={13}
                              />

                              {result.dataset}
                            </span>

                            {result.image && (
                              <span>
                                <ImageIcon
                                  size={13}
                                />
                                Visual resource
                              </span>
                            )}

                          </div>

                        </div>


                        <div className="result-actions">

                          <button
                            type="button"
                            className={`save-result ${
                              saved
                                ? 'saved'
                                : ''
                            }`}
                            onClick={(
                              event
                            ) => {
                              event.stopPropagation();

                              toggleBookmark(
                                result.id
                              );
                            }}
                            aria-label={
                              saved
                                ? 'Remove bookmark'
                                : 'Save resource'
                            }
                          >
                            {saved ? (
                              <BookmarkCheck
                                size={17}
                              />
                            ) : (
                              <Bookmark
                                size={17}
                              />
                            )}
                          </button>

                          <ChevronRight
                            size={18}
                            className="result-arrow"
                          />

                        </div>

                      </article>
                    );
                  }
                )}

              </div>
            )}

          </div>


          {/* =================================================
              PREVIEW
          ================================================= */}

          <aside className="knowledge-preview">

            {selectedResult ? (

              <div className="preview-card">

                <div className="preview-top">

                  <div className="preview-icon">
                    <Lightbulb size={20} />
                  </div>

                  <div className="preview-heading">

                    <span className="preview-kicker">
                      RESOURCE PREVIEW
                    </span>

                    <h2>
                      Explore the Example
                    </h2>

                  </div>


                  <button
                    type="button"
                    className={`preview-bookmark ${
                      isBookmarked(
                        selectedResult.id
                      )
                        ? 'saved'
                        : ''
                    }`}
                    onClick={() =>
                      toggleBookmark(
                        selectedResult.id
                      )
                    }
                    aria-label={
                      isBookmarked(
                        selectedResult.id
                      )
                        ? 'Remove bookmark'
                        : 'Save resource'
                    }
                  >
                    {isBookmarked(
                      selectedResult.id
                    ) ? (
                      <BookmarkCheck
                        size={18}
                      />
                    ) : (
                      <Bookmark
                        size={18}
                      />
                    )}
                  </button>

                </div>


                <div className="preview-tags">

                  <span>
                    {getSkillLabel(
                      selectedResult.skillName ||
                        selectedResult.skill
                    )}
                  </span>

                  <span
                    className={getDifficultyClass(
                      selectedResult.difficulty
                    )}
                  >
                    {String(
                      selectedResult.difficulty ||
                        'medium'
                    )
                      .charAt(0)
                      .toUpperCase() +
                      String(
                        selectedResult.difficulty ||
                          'medium'
                      ).slice(1)}
                  </span>

                </div>


                {selectedResult.image && (
                  <div className="preview-image">

                    <img
                      src={imageUrl(
                        selectedResult.image
                      )}
                      alt="Visual reasoning resource"
                      onError={(
                        event
                      ) => {
                        event.currentTarget.style.display =
                          'none';
                      }}
                    />

                  </div>
                )}


                <div className="preview-question">

                  <span>
                    REASONING PROMPT
                  </span>

                  <p>
                    {selectedResult.question}
                  </p>

                </div>


                {selectedResult.options?.length >
                  0 && (
                    <div className="preview-options">

                      <span>
                        AVAILABLE OPTIONS
                      </span>

                      <div>

                        {selectedResult.options.map(
                          (
                            option,
                            index
                          ) => (
                            <div
                              key={index}
                              className="preview-option"
                            >

                              <span>
                                {String.fromCharCode(
                                  65 +
                                    index
                                )}
                              </span>

                              <p>
                                {typeof option ===
                                'object'
                                  ? option?.text ||
                                    option?.label ||
                                    JSON.stringify(
                                      option
                                    )
                                  : option}
                              </p>

                            </div>
                          )
                        )}

                      </div>

                    </div>
                  )}


                <div className="preview-source">

                  <div className="source-icon">
                    <Database
                      size={16}
                    />
                  </div>

                  <div>

                    <span>
                      SOURCE
                    </span>

                    <strong>
                      {selectedResult.dataset}
                    </strong>

                  </div>

                </div>


                <div className="preview-notice">

                  <Eye size={15} />

                  <span>
                    Resources are provided for
                    exploration and practice.
                    Correct answers are intentionally
                    not displayed in the Knowledge Base.
                  </span>

                </div>

              </div>

            ) : (

              <div className="preview-placeholder">

                <div className="placeholder-orb">
                  <BookOpen size={30} />
                </div>

                <h3>
                  Select a resource
                </h3>

                <p>
                  Choose a reasoning resource from
                  the results to inspect its details.
                </p>

              </div>

            )}

          </aside>

        </section>


        {/* =================================================
            SIX DIMENSIONS
        ================================================= */}

        <section className="dimension-strip">

          <div className="dimension-heading">

            <span>
              SIX REASONING DIMENSIONS
            </span>

            <p>
              Explore the cognitive structure
              underlying Cognita AI.
            </p>

          </div>


          <div className="knowledge-dimension-grid">

            {SKILLS
              .filter(
                (item) =>
                  item.value !== 'all'
              )
              .map(
                (item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`knowledge-dimension-card ${
                      skill ===
                      item.value
                        ? 'active'
                        : ''
                    }`}
                    onClick={() => {

                      handleSkillChange(
                        item.value
                      );

                      if (!query.trim()) {
                        setQuery(
                          item.label
                        );
                      }

                    }}
                  >

                    <span className="dimension-symbol">
                      {item.label.charAt(0)}
                    </span>

                    <span className="dimension-name">
                      {item.label}
                    </span>

                    <ChevronRight
                      size={14}
                    />

                  </button>
                )
              )}

          </div>

        </section>

      </div>

    </div>
  );
}