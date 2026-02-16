-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE cron.job (
  jobid bigint NOT NULL DEFAULT nextval('cron.jobid_seq'::regclass),
  schedule text NOT NULL,
  command text NOT NULL,
  nodename text NOT NULL DEFAULT 'localhost'::text,
  nodeport integer NOT NULL DEFAULT inet_server_port(),
  database text NOT NULL DEFAULT current_database(),
  username text NOT NULL DEFAULT CURRENT_USER,
  active boolean NOT NULL DEFAULT true,
  jobname text,
  CONSTRAINT job_pkey PRIMARY KEY (jobid)
);
CREATE TABLE cron.job_run_details (
  jobid bigint,
  runid bigint NOT NULL DEFAULT nextval('cron.runid_seq'::regclass),
  job_pid integer,
  database text,
  username text,
  command text,
  status text,
  return_message text,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  CONSTRAINT job_run_details_pkey PRIMARY KEY (runid)
);