'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    // ── crm_agents ──────────────────────────────────────────────────────────
    await queryInterface.createTable('crm_agents', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING(100), allowNull: false },
      email: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      role: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'agent' },
      avatar: { type: Sequelize.STRING(500), allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      allowed_menus: { type: Sequelize.JSON, allowNull: true, defaultValue: null },
      site_ids: { type: Sequelize.JSON, allowNull: true, defaultValue: null },
      totp_secret: { type: Sequelize.STRING(100), allowNull: true, defaultValue: null },
      totp_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      active_conversations: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      resolved_today: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      rating: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 5.0 },
      last_active_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_customers ────────────────────────────────────────────────────────
    await queryInterface.createTable('crm_customers', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING(100), allowNull: false },
      email: { type: Sequelize.STRING(255), allowNull: true },
      phone: { type: Sequelize.STRING(50), allowNull: true },
      channel: { type: Sequelize.STRING(50), allowNull: true },
      tags: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: false, defaultValue: [] },
      notes: { type: Sequelize.TEXT, allowNull: true },
      total_conversations: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      last_seen: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_conversations ────────────────────────────────────────────────────
    await queryInterface.createTable('crm_conversations', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      customer_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'crm_customers', key: 'id' } },
      assigned_agent_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'crm_agents', key: 'id' } },
      locked_by_agent_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'crm_agents', key: 'id' } },
      channel: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'web' },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'open' },
      unread_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      last_message_at: { type: Sequelize.DATE, allowNull: true },
      locked_at: { type: Sequelize.DATE, allowNull: true },
      follow_up_at: { type: Sequelize.DATE, allowNull: true },
      follow_up_note: { type: Sequelize.TEXT, allowNull: true },
      follow_up_type: { type: Sequelize.STRING(20), allowNull: true },
      reopen_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_messages ─────────────────────────────────────────────────────────
    await queryInterface.createTable('crm_messages', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      conversation_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'crm_conversations', key: 'id' } },
      sender: { type: Sequelize.STRING(20), allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: false },
      is_read: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_campaigns ────────────────────────────────────────────────────────
    await queryInterface.createTable('crm_campaigns', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING(200), allowNull: false },
      channel: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'email' },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'draft' },
      message: { type: Sequelize.TEXT, allowNull: false, defaultValue: '' },
      recipients: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      sent_at: { type: Sequelize.DATE, allowNull: true },
      scheduled_at: { type: Sequelize.DATE, allowNull: true },
      open_rate: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      click_rate: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_channels ─────────────────────────────────────────────────────────
    await queryInterface.createTable('crm_channels', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      type: { type: Sequelize.STRING(50), allowNull: false },
      name: { type: Sequelize.STRING(100), allowNull: false },
      site_id: { type: Sequelize.INTEGER, allowNull: true },
      is_connected: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      access_token: { type: Sequelize.TEXT, allowNull: true },
      phone_number_id: { type: Sequelize.STRING(100), allowNull: true },
      waba_id: { type: Sequelize.STRING(100), allowNull: true },
      page_id: { type: Sequelize.STRING(100), allowNull: true },
      page_access_token: { type: Sequelize.TEXT, allowNull: true },
      webhook_verify_token: { type: Sequelize.STRING(100), allowNull: false, defaultValue: '' },
      instagram_account_id: { type: Sequelize.STRING(100), allowNull: true },
      twitter_api_key: { type: Sequelize.STRING(200), allowNull: true },
      twitter_api_secret: { type: Sequelize.TEXT, allowNull: true },
      twitter_bearer_token: { type: Sequelize.TEXT, allowNull: true },
      twitter_access_token: { type: Sequelize.TEXT, allowNull: true },
      twitter_access_token_secret: { type: Sequelize.TEXT, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_closed_conversations ─────────────────────────────────────────────
    await queryInterface.createTable('crm_closed_conversations', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      original_id: { type: Sequelize.INTEGER, allowNull: false },
      customer_id: { type: Sequelize.INTEGER, allowNull: false },
      customer_name: { type: Sequelize.STRING(100), allowNull: false },
      customer_phone: { type: Sequelize.STRING(50), allowNull: true },
      assigned_agent_id: { type: Sequelize.INTEGER, allowNull: true },
      assigned_agent_name: { type: Sequelize.STRING(100), allowNull: true },
      closed_by_agent_id: { type: Sequelize.INTEGER, allowNull: true },
      closed_by_agent_name: { type: Sequelize.STRING(100), allowNull: true },
      channel: { type: Sequelize.STRING(50), allowNull: false },
      message_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      closed_at: { type: Sequelize.DATE, allowNull: false },
      original_created_at: { type: Sequelize.DATE, allowNull: false },
      summary: { type: Sequelize.TEXT, allowNull: true },
      messages_deleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_closed_messages ──────────────────────────────────────────────────
    await queryInterface.createTable('crm_closed_messages', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      closed_conversation_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'crm_closed_conversations', key: 'id' } },
      sender: { type: Sequelize.STRING(20), allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: false },
      is_read: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      original_created_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_feedback ─────────────────────────────────────────────────────────
    await queryInterface.createTable('crm_feedback', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      conversation_id: { type: Sequelize.INTEGER, allowNull: true },
      customer_id: { type: Sequelize.INTEGER, allowNull: true },
      rating: { type: Sequelize.INTEGER, allowNull: false },
      comment: { type: Sequelize.TEXT, allowNull: true },
      channel: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'whatsapp' },
      agent_id: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_knowledge_docs ───────────────────────────────────────────────────
    await queryInterface.createTable('crm_knowledge_docs', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      filename: { type: Sequelize.STRING(255), allowNull: false },
      original_name: { type: Sequelize.STRING(255), allowNull: false },
      mime_type: { type: Sequelize.STRING(100), allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: false },
      size_bytes: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_ai_settings ──────────────────────────────────────────────────────
    await queryInterface.createTable('crm_ai_settings', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      provider: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'gemini' },
      model: { type: Sequelize.STRING(100), allowNull: false, defaultValue: 'gemini-2.5-flash' },
      api_key: { type: Sequelize.TEXT, allowNull: true },
      base_url: { type: Sequelize.TEXT, allowNull: true },
      temperature: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0.7 },
      max_tokens: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 8192 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_email_settings ───────────────────────────────────────────────────
    await queryInterface.createTable('crm_email_settings', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      provider: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'mailgun' },
      api_key: { type: Sequelize.TEXT, allowNull: true },
      domain: { type: Sequelize.STRING(255), allowNull: true },
      region: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'us' },
      from_email: { type: Sequelize.STRING(255), allowNull: true },
      from_name: { type: Sequelize.STRING(255), allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_agent_kpis ───────────────────────────────────────────────────────
    await queryInterface.createTable('crm_agent_kpis', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      agent_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'crm_agents', key: 'id' } },
      period: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'weekly' },
      target_conversations: { type: Sequelize.INTEGER, allowNull: true },
      target_response_time_mins: { type: Sequelize.FLOAT, allowNull: true },
      target_resolution_rate: { type: Sequelize.FLOAT, allowNull: true },
      target_csat_score: { type: Sequelize.FLOAT, allowNull: true },
      target_reopen_rate: { type: Sequelize.FLOAT, allowNull: true },
      target_handle_time_mins: { type: Sequelize.FLOAT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_agent_attendance ─────────────────────────────────────────────────
    await queryInterface.createTable('crm_agent_attendance', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      agent_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'crm_agents', key: 'id' } },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      clock_in: { type: Sequelize.DATE, allowNull: true },
      clock_out: { type: Sequelize.DATE, allowNull: true },
      duration_minutes: { type: Sequelize.INTEGER, allowNull: true },
      clock_in_lat: { type: Sequelize.STRING(30), allowNull: true },
      clock_in_lng: { type: Sequelize.STRING(30), allowNull: true },
      clock_out_lat: { type: Sequelize.STRING(30), allowNull: true },
      clock_out_lng: { type: Sequelize.STRING(30), allowNull: true },
      face_image_in: { type: Sequelize.TEXT, allowNull: true },
      face_image_out: { type: Sequelize.TEXT, allowNull: true },
      clock_in_photo_time: { type: Sequelize.DATE, allowNull: true },
      clock_out_photo_time: { type: Sequelize.DATE, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      face_review_status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'pending' },
      face_reviewed_by: { type: Sequelize.INTEGER, allowNull: true },
      face_reviewed_at: { type: Sequelize.DATE, allowNull: true },
      shift_start_expected: { type: Sequelize.STRING(5), allowNull: true },
      shift_grace_minutes: { type: Sequelize.INTEGER, allowNull: true },
      clock_in_diff_minutes: { type: Sequelize.INTEGER, allowNull: true },
      device_id: { type: Sequelize.STRING(64), allowNull: true },
      device_type: { type: Sequelize.STRING(20), allowNull: true },
      device_browser: { type: Sequelize.STRING(40), allowNull: true },
      device_os: { type: Sequelize.STRING(40), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_agent_attendance_pings ───────────────────────────────────────────
    await queryInterface.createTable('crm_agent_attendance_pings', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      attendance_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'crm_agent_attendance', key: 'id' } },
      agent_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'crm_agents', key: 'id' } },
      lat: { type: Sequelize.STRING(30), allowNull: false },
      lng: { type: Sequelize.STRING(30), allowNull: false },
      recorded_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_agent_shifts ─────────────────────────────────────────────────────
    await queryInterface.createTable('crm_agent_shifts', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      agent_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'crm_agents', key: 'id' } },
      shift_name: { type: Sequelize.STRING(100), allowNull: false },
      start_time: { type: Sequelize.STRING(5), allowNull: false },
      end_time: { type: Sequelize.STRING(5), allowNull: false },
      days_of_week: { type: Sequelize.TEXT, allowNull: false, defaultValue: '[1,2,3,4,5]' },
      grace_minutes: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 15 },
      timezone: { type: Sequelize.STRING(60), allowNull: false, defaultValue: 'UTC' },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_branding_settings ────────────────────────────────────────────────
    await queryInterface.createTable('crm_branding_settings', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      app_name: { type: Sequelize.STRING(100), allowNull: false, defaultValue: 'CommsCRM' },
      primary_color: { type: Sequelize.STRING(20), allowNull: false, defaultValue: '#4F46E5' },
      sidebar_color: { type: Sequelize.STRING(20), allowNull: false, defaultValue: '#3F0E40' },
      logo_data: { type: Sequelize.TEXT('long'), allowNull: true },
      background_data: { type: Sequelize.TEXT('long'), allowNull: true },
      default_currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'USD' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_retention_settings ───────────────────────────────────────────────
    await queryInterface.createTable('crm_retention_settings', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      retention_days: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 90 },
      summarize_before_delete: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      auto_run_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      action: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'archive' },
      channel_filter: { type: Sequelize.TEXT, allowNull: false, defaultValue: '["all"]' },
      include_closed_messages: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      include_feedback: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      min_message_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_follow_up_rules ──────────────────────────────────────────────────
    await queryInterface.createTable('crm_follow_up_rules', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING(120), allowNull: false },
      category: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'custom' },
      is_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      delay_days: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 3 },
      trigger: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'resolved' },
      inactivity_days: { type: Sequelize.INTEGER, allowNull: true },
      message_template: { type: Sequelize.TEXT, allowNull: false, defaultValue: '' },
      use_ai_personalization: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      assign_to_last_agent: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      priority: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'medium' },
      send_between_hours_start: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 9 },
      send_between_hours_end: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 18 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_sites ────────────────────────────────────────────────────────────
    await queryInterface.createTable('crm_sites', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING(100), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      region: { type: Sequelize.STRING(100), allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_payment_configs ──────────────────────────────────────────────────
    await queryInterface.createTable('crm_payment_configs', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      provider: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      is_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      is_live_mode: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      public_key: { type: Sequelize.TEXT, allowNull: true },
      secret_key: { type: Sequelize.TEXT, allowNull: true },
      webhook_secret: { type: Sequelize.TEXT, allowNull: true },
      webhook_token: { type: Sequelize.STRING(64), allowNull: false, defaultValue: '' },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_payment_transactions ─────────────────────────────────────────────
    await queryInterface.createTable('crm_payment_transactions', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      provider: { type: Sequelize.STRING(30), allowNull: false },
      tx_ref: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      amount: { type: Sequelize.FLOAT, allowNull: false },
      currency: { type: Sequelize.STRING(5), allowNull: false, defaultValue: 'USD' },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'pending' },
      customer_name: { type: Sequelize.STRING(200), allowNull: false, defaultValue: '' },
      customer_email: { type: Sequelize.STRING(255), allowNull: false, defaultValue: '' },
      description: { type: Sequelize.TEXT, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      paid_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_payment_links ────────────────────────────────────────────────────
    await queryInterface.createTable('crm_payment_links', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      provider: { type: Sequelize.STRING(30), allowNull: false },
      title: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      amount: { type: Sequelize.FLOAT, allowNull: false },
      currency: { type: Sequelize.STRING(5), allowNull: false, defaultValue: 'USD' },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'active' },
      link_token: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      link_url: { type: Sequelize.STRING(500), allowNull: true },
      expires_at: { type: Sequelize.DATE, allowNull: true },
      paid_at: { type: Sequelize.DATE, allowNull: true },
      customer_name: { type: Sequelize.STRING(200), allowNull: true },
      customer_email: { type: Sequelize.STRING(255), allowNull: true },
      created_by: { type: Sequelize.STRING(255), allowNull: false, defaultValue: '' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_ai_exceptions ────────────────────────────────────────────────────
    await queryInterface.createTable('crm_ai_exceptions', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      type: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'exception' },
      phrase: { type: Sequelize.TEXT, allowNull: false, defaultValue: '' },
      reason: { type: Sequelize.TEXT, allowNull: true },
      content: { type: Sequelize.TEXT, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_product_categories ───────────────────────────────────────────────
    await queryInterface.createTable('crm_product_categories', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_product_sources ──────────────────────────────────────────────────
    await queryInterface.createTable('crm_product_sources', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING(200), allowNull: false },
      type: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'api' },
      api_url: { type: Sequelize.TEXT, allowNull: true },
      api_key: { type: Sequelize.TEXT, allowNull: true },
      webhook_secret: { type: Sequelize.STRING(255), allowNull: true },
      header_key: { type: Sequelize.STRING(100), allowNull: true },
      header_value: { type: Sequelize.TEXT, allowNull: true },
      field_mapping: { type: Sequelize.JSONB, allowNull: true },
      sync_interval: { type: Sequelize.INTEGER, allowNull: true },
      last_sync_at: { type: Sequelize.DATE, allowNull: true },
      last_sync_status: { type: Sequelize.STRING(50), allowNull: true },
      last_sync_count: { type: Sequelize.INTEGER, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_products ─────────────────────────────────────────────────────────
    await queryInterface.createTable('crm_products', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      external_id: { type: Sequelize.STRING(255), allowNull: true },
      name: { type: Sequelize.STRING(500), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      sku: { type: Sequelize.STRING(100), allowNull: true },
      price: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'USD' },
      category_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'crm_product_categories', key: 'id' } },
      image_url: { type: Sequelize.TEXT, allowNull: true },
      stock_qty: { type: Sequelize.INTEGER, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      source_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'crm_product_sources', key: 'id' } },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_customer_groups ──────────────────────────────────────────────────
    await queryInterface.createTable('crm_customer_groups', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING(120), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      type: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'manual' },
      filters: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // ── crm_customer_group_members ───────────────────────────────────────────
    await queryInterface.createTable('crm_customer_group_members', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      group_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'crm_customer_groups', key: 'id' } },
      customer_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'crm_customers', key: 'id' } },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
  },

  async down(queryInterface) {
    const tables = [
      'crm_customer_group_members',
      'crm_customer_groups',
      'crm_products',
      'crm_product_sources',
      'crm_product_categories',
      'crm_ai_exceptions',
      'crm_payment_links',
      'crm_payment_transactions',
      'crm_payment_configs',
      'crm_sites',
      'crm_follow_up_rules',
      'crm_retention_settings',
      'crm_branding_settings',
      'crm_agent_shifts',
      'crm_agent_attendance_pings',
      'crm_agent_attendance',
      'crm_agent_kpis',
      'crm_email_settings',
      'crm_ai_settings',
      'crm_knowledge_docs',
      'crm_feedback',
      'crm_closed_messages',
      'crm_closed_conversations',
      'crm_channels',
      'crm_campaigns',
      'crm_messages',
      'crm_conversations',
      'crm_customers',
      'crm_agents',
    ];
    for (const table of tables) {
      await queryInterface.dropTable(table, { force: true });
    }
  },
};

