const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000';


// =========================================================
// AUTH TOKEN
// =========================================================

function getToken() {
  return localStorage.getItem('cognita_token');
}


// =========================================================
// API REQUEST HELPER
// =========================================================

async function request(path, options = {}) {
  const url = API_URL
    ? `${API_URL}${path}`
    : path;

  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Attach JWT token when available
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (error) {
    console.error('API connection error:', error);

    throw new ApiError(
      'Unable to reach the server. Please make sure the backend is running.'
    );
  }

  const contentType =
    response.headers.get('content-type') || '';

  const isJson =
    contentType.includes('application/json');

  let data = null;

  try {
    data = isJson
      ? await response.json()
      : null;
  } catch (error) {
    console.error(
      'Failed to parse API response:',
      error
    );
  }


  // =======================================================
  // API ERROR HANDLING
  // =======================================================

  if (!response.ok) {
    let message;

    if (
      typeof data?.detail === 'string'
    ) {
      message = data.detail;

    } else if (
      typeof data?.message === 'string'
    ) {
      message = data.message;

    } else if (
      data?.detail &&
      typeof data.detail === 'object' &&
      typeof data.detail.message === 'string'
    ) {
      message = data.detail.message;

    } else if (
      data?.detail &&
      typeof data.detail === 'object'
    ) {
      message = JSON.stringify(data.detail);

    } else if (
      data &&
      typeof data === 'object'
    ) {
      message = JSON.stringify(data);

    } else {
      message =
        `Request failed (${response.status}). Please try again.`;
    }

    throw new ApiError(
      message,
      response.status
    );
  }

  return data;
}


// =========================================================
// API ERROR CLASS
// =========================================================

export class ApiError extends Error {
  constructor(
    message,
    status = null
  ) {
    super(message);

    this.name = 'ApiError';
    this.status = status;
  }
}


// =========================================================
// API
// =========================================================

export const api = {

  // =======================================================
  // AUTHENTICATION
  // =======================================================

  register: (
    name,
    email,
    password
  ) =>
    request(
      '/api/auth/register',
      {
        method: 'POST',

        body: JSON.stringify({
          name,
          email,
          password,
        }),
      }
    ),


  login: (
    email,
    password
  ) =>
    request(
      '/api/auth/login',
      {
        method: 'POST',

        body: JSON.stringify({
          email,
          password,
        }),
      }
    ),


  me: () =>
    request('/api/auth/me'),


  // =======================================================
  // FORGOT PASSWORD
  // =======================================================

  forgotPassword: async (
    email
  ) => {
    const response =
      await request(
        '/api/auth/forgot-password',
        {
          method: 'POST',

          body: JSON.stringify({
            email,
          }),
        }
      );

    return (
      response?.data ??
      response
    );
  },


  verifyResetOtp: async (
    email,
    otp
  ) => {
    const response =
      await request(
        '/api/auth/verify-reset-otp',
        {
          method: 'POST',

          body: JSON.stringify({
            email,
            otp,
          }),
        }
      );

    return (
      response?.data ??
      response
    );
  },


  resetPassword: async (
    resetToken,
    password
  ) => {
    const response =
      await request(
        '/api/auth/reset-password',
        {
          method: 'POST',

          body: JSON.stringify({
            reset_token: resetToken,
            password,
          }),
        }
      );

    return (
      response?.data ??
      response
    );
  },


  // =======================================================
  // PRE-ASSESSMENT
  // =======================================================

  startAssessment: () =>
    request(
      '/api/assessment/start',
      {
        method: 'POST',
      }
    ),


  submitAssessment: (
    responses
  ) =>
    request(
      '/api/assessment/submit',
      {
        method: 'POST',

        body: JSON.stringify({
          responses,
        }),
      }
    ),


  // =======================================================
  // COGNITIVE PROFILE
  // =======================================================

  getProfile: async () => {
    const response =
      await request(
        '/api/profile'
      );

    return (
      response?.data ??
      response
    );
  },


  // =======================================================
  // LEARNING PATH
  // =======================================================

  /*
   * Learning Path currently uses the existing
   * training recommendation endpoint.
   *
   * This avoids creating a duplicate backend system.
   */

  getLearningPath:
    async () => {
      const response =
        await request(
          '/api/training/recommendation'
        );

      return (
        response?.data ??
        response
      );
    },


  // =======================================================
  // ADAPTIVE TRAINING
  // =======================================================

  getTrainingRecommendation:
    async () => {
      const response =
        await request(
          '/api/training/recommendation'
        );

      return (
        response?.data ??
        response
      );
    },


  generateTraining:
    async (
      skill,
      difficulty
    ) => {
      const response =
        await request(
          '/api/training/generate',
          {
            method: 'POST',

            body: JSON.stringify({
              skill,

              ...(difficulty
                ? {
                    difficulty,
                  }
                : {}),
            }),
          }
        );

      return (
        response?.data ??
        response
      );
    },


  submitTraining:
    async (
      payload
    ) => {
      const response =
        await request(
          '/api/training/submit',
          {
            method: 'POST',

            body: JSON.stringify(
              payload
            ),
          }
        );

      return (
        response?.data ??
        response
      );
    },


  // =======================================================
  // PROGRESS
  // =======================================================

  getProgress:
    async () => {
      const response =
        await request(
          '/api/progress'
        );

      return (
        response?.data ??
        response
      );
    },


  // =======================================================
  // POST-ASSESSMENT
  // =======================================================

  startPostAssessment:
    () =>
      request(
        '/api/assessment/start?assessment_type=post',
        {
          method: 'POST',
        }
      ),


  submitPostAssessment:
    (
      responses
    ) =>
      request(
        '/api/assessment/submit?assessment_type=post',
        {
          method: 'POST',

          body: JSON.stringify({
            responses,
          }),
        }
      ),


  // =======================================================
  // ASSESSMENT REVIEW
  // =======================================================

  getAssessmentReviews:
    async () => {
      const response =
        await request(
          '/api/assessment/reviews'
        );

      return (
        response?.data ??
        response
      );
    },


  // =======================================================
  // POST-ASSESSMENT REPORTS
  // =======================================================

  getPostAssessmentReports:
    async () => {
      const response =
        await request(
          '/api/post-assessment/reports'
        );

      return (
        response?.data ??
        response
      );
    },


  getPostAssessmentReport:
    async (
      attempt
    ) => {
      const response =
        await request(
          `/api/post-assessment/reports/${encodeURIComponent(
            attempt
          )}`
        );

      return (
        response?.data ??
        response
      );
    },


  // =======================================================
  // AI TUTOR
  // =======================================================

  /*
   * AI Tutor is only for:
   * - concept explanations
   * - doubt clearing
   * - simpler explanations
   * - examples
   *
   * It is NOT an assessment system.
   */

  chatWithTutor:
    async (
      payload
    ) => {
      const response =
        await request(
          '/api/tutor/chat',
          {
            method: 'POST',

            body: JSON.stringify(
              payload
            ),
          }
        );

      return (
        response?.data ??
        response
      );
    },


  // =======================================================
  // KNOWLEDGE BASE
  // =======================================================

  /*
   * Student-facing read-only semantic search
   * over the existing RAG knowledge base.
   *
   * Correct answers are not exposed.
   */

  searchKnowledge:
    async (
      query,
      options = {}
    ) => {

      const params =
        new URLSearchParams();

      params.set(
        'q',
        query
      );

      if (options.skill) {
        params.set(
          'skill',
          options.skill
        );
      }

      if (options.difficulty) {
        params.set(
          'difficulty',
          options.difficulty
        );
      }

      if (options.limit) {
        params.set(
          'limit',
          String(options.limit)
        );
      }

      const response =
        await request(
          `/api/knowledge/search?${params.toString()}`
        );

      return (
        response?.data ??
        response
      );
    },


  getKnowledgeDimensions:
    async () => {
      const response =
        await request(
          '/api/knowledge/dimensions'
        );

      return (
        response?.data ??
        response
      );
    },

};


// =========================================================
// EXPORT API URL
// =========================================================

export {
  API_URL,
};