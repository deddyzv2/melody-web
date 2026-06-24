SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict evHkQtgSgeFl0wuokVLBHzKBckuZZPqFdESBTjVB2e7NFb0aOlcd7nXWHvC2e3d

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: characters; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."characters" ("id", "name", "role", "personality", "visual_notes", "created_at", "position_x", "position_y") VALUES
	('9ec9758d-cc57-4177-a72b-5bbea1af492f', 'Alan Naufal', 'MC', 'dasd', 'asdas', '2026-06-23 03:13:00.008166', 135.70181863387086, 420.70678119684123),
	('8f60dd96-5a66-48fc-877c-0f89e73237fa', 'Fenny Anggraeni', 'Heroine 2', 'sss', 'sss', '2026-06-23 03:12:48.124079', 414.5505835038688, 188.0598321068145),
	('410cbdbf-1a7a-47f7-bba8-2d0c5ed4409d', 'Siska Zaskia', 'Guru BK', '', '', '2026-06-24 03:05:41.051433', 474.36598297224566, 315.0733380438397),
	('90118a25-7ecb-4ad6-9f52-232312659ec2', 'Aldi Nugroho', 'Sahabat Alan', '', '', '2026-06-24 03:05:31.86957', 119.2656800980418, 100.23585973294934),
	('23197159-bcaa-4494-85b6-2699cc55efd0', 'Mutiara Syafira', 'adik Alan', '', '', '2026-06-24 03:32:02.307093', -135.995885307327, 421.5940784400143),
	('22cc6ba5-745d-4cc2-9d37-f57ba1d2bdf4', 'Cynthia Iskandar', 'Heroine 1', '', '', '2026-06-23 03:55:25.395541', -150.03772752344167, 216.86240515198065);


--
-- Data for Name: comic_pages; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."comic_pages" ("id", "title", "summary", "order_index", "created_at") VALUES
	('62dbf43d-39bd-4d5a-bc28-4d20140d205f', 'Halaman 1', '', 1, '2026-06-24 02:35:47.177559+00');


--
-- Data for Name: comic_panels; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: story_fragments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."story_fragments" ("id", "title", "content", "order_index", "created_at", "route_name", "position_x", "position_y") VALUES
	('0ff91181-fb74-4b1d-aaa8-ebb47866cf2c', 'zxz', 'zxczxc', 1, '2026-06-23 04:00:42.389625', 'Rute Utama', -317.1290378216347, 147.52340966154736),
	('e68d9dba-d84a-4f46-8f93-042deb92dc56', 'asdasd', 'asdasdas', 3, '2026-06-23 04:11:23.742473', 'Rute Utama', -24.602790846097037, 27.234089639011074),
	('82fe7708-9822-4db2-a8be-af52d3a17f4a', 'judul', 'catatanaanaaaaaaaaaaaaaaaaaaaaaaaaaa', 2, '2026-06-23 04:00:58.177461', 'Rute Utama', -42.32842380612419, 241.99295506575157);


--
-- Data for Name: fragment_characters; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."fragment_characters" ("id", "fragment_id", "character_id", "created_at") VALUES
	('78111413-5fe5-4485-b425-73ecb24eb86b', '82fe7708-9822-4db2-a8be-af52d3a17f4a', '9ec9758d-cc57-4177-a72b-5bbea1af492f', '2026-06-23 04:01:07.423007+00');


--
-- Data for Name: fragment_connections; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."fragment_connections" ("id", "from_fragment_id", "to_fragment_id", "label", "created_at") VALUES
	('45bff997-d9d5-443c-8f1c-0f75443d6b26', '0ff91181-fb74-4b1d-aaa8-ebb47866cf2c', 'e68d9dba-d84a-4f46-8f93-042deb92dc56', NULL, '2026-06-24 03:01:05.536454+00'),
	('4f35cd10-310f-460d-ad93-6a07ae2aaf3c', '0ff91181-fb74-4b1d-aaa8-ebb47866cf2c', '82fe7708-9822-4db2-a8be-af52d3a17f4a', NULL, '2026-06-24 03:01:09.053923+00');


--
-- Data for Name: inbox_items; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: progress_log; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: relationships; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."relationships" ("id", "character_a", "character_b", "relation_type", "created_at", "label_offset_x", "label_offset_y") VALUES
	('0e5434b9-5bb3-4fac-b1dd-f25f47fdf8cc', '22cc6ba5-745d-4cc2-9d37-f57ba1d2bdf4', '90118a25-7ecb-4ad6-9f52-232312659ec2', 'teman sekelas', '2026-06-24 03:06:31.734559', 0, 0),
	('ba77577a-71e5-4f76-beda-c7ce9a802e9a', '22cc6ba5-745d-4cc2-9d37-f57ba1d2bdf4', '9ec9758d-cc57-4177-a72b-5bbea1af492f', 'membenci', '2026-06-24 03:07:08.168228', 0, 0),
	('5a6ac55e-913b-4fea-97a3-6878f97979a6', '9ec9758d-cc57-4177-a72b-5bbea1af492f', '410cbdbf-1a7a-47f7-bba8-2d0c5ed4409d', 'guru crush', '2026-06-24 03:30:38.57683', 0, 0),
	('7e9a8d1e-184d-4085-9194-93bf15023a78', '90118a25-7ecb-4ad6-9f52-232312659ec2', '8f60dd96-5a66-48fc-877c-0f89e73237fa', 'menyukai', '2026-06-24 03:31:20.254283', 0, 0),
	('0e2928cf-b8a6-4121-a21c-9699e530440d', '9ec9758d-cc57-4177-a72b-5bbea1af492f', '90118a25-7ecb-4ad6-9f52-232312659ec2', 'teman dari SMP', '2026-06-24 03:30:03.599004', -22.39984241250809, -52.639620440946125),
	('53dab9c1-e332-498e-914f-13d526c7ddcb', '22cc6ba5-745d-4cc2-9d37-f57ba1d2bdf4', '410cbdbf-1a7a-47f7-bba8-2d0c5ed4409d', 'guru BK', '2026-06-24 03:31:02.393437', 10.079926009479346, -3.360016351817047),
	('f914bd33-fde4-4270-8490-57c73f076072', '8f60dd96-5a66-48fc-877c-0f89e73237fa', '9ec9758d-cc57-4177-a72b-5bbea1af492f', 'menyukai', '2026-06-24 03:07:36.279957', 2.502399060832481, -75.49453507336447),
	('478abfab-bc24-4693-90e0-eb09cf512c5a', '9ec9758d-cc57-4177-a72b-5bbea1af492f', '8f60dd96-5a66-48fc-877c-0f89e73237fa', 'teman sekelas', '2026-06-23 03:55:39.014329', 79.09072329976094, -20.763692576440896),
	('5f862df4-e819-402f-abd5-1d4918177bb6', '22cc6ba5-745d-4cc2-9d37-f57ba1d2bdf4', '23197159-bcaa-4494-85b6-2699cc55efd0', 'adik2an', '2026-06-24 03:33:28.57906', 0, 0),
	('05190221-4af2-45cb-9727-d7c03cb24a20', '9ec9758d-cc57-4177-a72b-5bbea1af492f', '23197159-bcaa-4494-85b6-2699cc55efd0', 'adik', '2026-06-24 03:33:39.664582', 0, 0);


--
-- Data for Name: story_chapters; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."story_chapters" ("id", "type", "title", "content", "order_index", "updated_at") VALUES
	('23d85af7-e7c7-4ea9-b9ba-7e19e21f0386', 'full', 'Chapter baru', '', 1, '2026-06-24 03:41:10.748634+00'),
	('897390dd-2e0b-4030-8dc7-4829613c644d', 'ringkasan', 'Ringkasan baru', '', 1, '2026-06-24 03:43:09.284098+00');


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

-- \unrestrict evHkQtgSgeFl0wuokVLBHzKBckuZZPqFdESBTjVB2e7NFb0aOlcd7nXWHvC2e3d

RESET ALL;
