// Update with your config settings.

module.exports = {

  development: {
    client: 'mysql2',
    connection: {
      database: 'gsdb',
      user: 'gsdb',
      password: '',
      host: 'localhost',
      charset: 'utf8mb4'
    },
    pool: {
      min: 2,
      max: 10
    }
  },

  staging: {
    client: 'mysql2',
    connection: {
      database: 'gsdb',
      user: 'gsdb',
      password: '',
      host: 'localhost',
      charset: 'utf8mb4'
    },
    pool: {
      min: 2,
      max: 10
    }
  },

  production: {
    client: 'mysql2',
    connection: {
      database: 'gsdb',
      user: 'gsdb',
      password: '',
      host: 'localhost',
      charset: 'utf8mb4'
    },
    pool: {
      min: 2,
      max: 10
    }
  }

};
