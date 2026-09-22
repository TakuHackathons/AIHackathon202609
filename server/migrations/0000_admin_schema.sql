CREATE TABLE `academic_terms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`name` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "academic_terms_dates" CHECK("academic_terms"."starts_on" <= "academic_terms"."ends_on")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `academic_terms_school_name` ON `academic_terms` (`school_id`,`name`);--> statement-breakpoint
CREATE INDEX `academic_terms_school_dates` ON `academic_terms` (`school_id`,`starts_on`,`ends_on`);--> statement-breakpoint
CREATE TABLE `assignment_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`assignment_id` integer NOT NULL,
	`r2_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`page_count` integer,
	`extraction_status` text DEFAULT 'pending' NOT NULL,
	`extraction_error` text DEFAULT '' NOT NULL,
	`extracted_text` text DEFAULT '' NOT NULL,
	`extracted_at` integer,
	`uploaded_by` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "assignment_files_size" CHECK("assignment_files"."size" >= 0),
	CONSTRAINT "assignment_files_extraction_status" CHECK("assignment_files"."extraction_status" IN ('pending','processing','completed','failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assignment_files_r2_key_unique` ON `assignment_files` (`r2_key`);--> statement-breakpoint
CREATE INDEX `assignment_files_assignment` ON `assignment_files` (`assignment_id`);--> statement-breakpoint
CREATE INDEX `assignment_files_extraction` ON `assignment_files` (`extraction_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `assignment_files_assignment_hash` ON `assignment_files` (`assignment_id`,`sha256`);--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`published_at` integer,
	`due_at` integer,
	`external_url` text DEFAULT '' NOT NULL,
	`created_by` integer NOT NULL,
	`updated_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "assignments_dates" CHECK("assignments"."due_at" IS NULL OR "assignments"."published_at" IS NULL OR "assignments"."published_at" <= "assignments"."due_at")
);
--> statement-breakpoint
CREATE INDEX `assignments_course_due` ON `assignments` (`course_id`,`due_at`);--> statement-breakpoint
CREATE TABLE `auth_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key_hash` text NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_attempts_key_hash_unique` ON `auth_attempts` (`key_hash`);--> statement-breakpoint
CREATE INDEX `auth_attempts_expiry` ON `auth_attempts` (`expires_at`);--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_session_id` integer NOT NULL,
	`student_id` integer NOT NULL,
	`status` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`recorded_by` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`course_session_id`) REFERENCES `course_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "attendance_status_check" CHECK("attendance"."status" IN ('present','late','absent','excused')),
	CONSTRAINT "attendance_source" CHECK("attendance"."source" IN ('manual','csv'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_session_student` ON `attendance` (`course_session_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `attendance_student_session` ON `attendance` (`student_id`,`course_session_id`);--> statement-breakpoint
CREATE INDEX `attendance_status` ON `attendance` (`status`);--> statement-breakpoint
CREATE TABLE `challenges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`challenge` text NOT NULL,
	`kind` text NOT NULL,
	`user_id` integer,
	`auth_version` integer,
	`session_id` integer,
	`name` text,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "challenges_kind" CHECK("challenges"."kind" IN ('registration','authentication'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `challenges_token_hash_unique` ON `challenges` (`token_hash`);--> statement-breakpoint
CREATE INDEX `challenges_user` ON `challenges` (`user_id`);--> statement-breakpoint
CREATE INDEX `challenges_expiry` ON `challenges` (`expires_at`);--> statement-breakpoint
CREATE TABLE `course_enrollments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`student_id` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`enrolled_at` integer NOT NULL,
	`withdrawn_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "course_enrollments_status" CHECK("course_enrollments"."status" IN ('active','withdrawn','completed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_enrollments_unique` ON `course_enrollments` (`course_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `course_enrollments_student_status` ON `course_enrollments` (`student_id`,`status`);--> statement-breakpoint
CREATE INDEX `course_enrollments_course_status` ON `course_enrollments` (`course_id`,`status`);--> statement-breakpoint
CREATE TABLE `course_schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`period_id` integer NOT NULL,
	`facility_id` integer,
	`weekday` integer NOT NULL,
	`location_note` text DEFAULT '' NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text NOT NULL,
	`created_by` integer,
	`updated_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`period_id`) REFERENCES `school_periods`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "course_schedules_weekday" CHECK("course_schedules"."weekday" BETWEEN 0 AND 6),
	CONSTRAINT "course_schedules_dates" CHECK("course_schedules"."valid_from" <= "course_schedules"."valid_to")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_schedules_unique` ON `course_schedules` (`course_id`,`weekday`,`period_id`,`valid_from`);--> statement-breakpoint
CREATE INDEX `course_schedules_course_weekday` ON `course_schedules` (`course_id`,`weekday`);--> statement-breakpoint
CREATE INDEX `course_schedules_facility` ON `course_schedules` (`facility_id`,`weekday`,`period_id`);--> statement-breakpoint
CREATE TABLE `course_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`course_schedule_id` integer,
	`schedule_exception_id` integer,
	`period_id` integer,
	`facility_id` integer,
	`session_date` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`location_note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`source` text NOT NULL,
	`created_by` integer,
	`updated_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_schedule_id`) REFERENCES `course_schedules`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`schedule_exception_id`) REFERENCES `schedule_exceptions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`period_id`) REFERENCES `school_periods`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "course_sessions_status" CHECK("course_sessions"."status" IN ('scheduled','cancelled','completed')),
	CONSTRAINT "course_sessions_source" CHECK("course_sessions"."source" IN ('recurring','exception','manual')),
	CONSTRAINT "course_sessions_times" CHECK("course_sessions"."starts_at" < "course_sessions"."ends_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_sessions_unique` ON `course_sessions` (`course_id`,`session_date`,`starts_at`);--> statement-breakpoint
CREATE INDEX `course_sessions_course_date` ON `course_sessions` (`course_id`,`session_date`);--> statement-breakpoint
CREATE INDEX `course_sessions_facility_date` ON `course_sessions` (`facility_id`,`session_date`,`starts_at`);--> statement-breakpoint
CREATE TABLE `course_teachers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`teacher_id` integer NOT NULL,
	`assignment_role` text DEFAULT 'primary' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "course_teachers_role" CHECK("course_teachers"."assignment_role" IN ('primary','assistant'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_teachers_unique` ON `course_teachers` (`course_id`,`teacher_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `course_teachers_one_primary` ON `course_teachers` (`course_id`) WHERE "course_teachers"."assignment_role" = 'primary';--> statement-breakpoint
CREATE INDEX `course_teachers_teacher` ON `course_teachers` (`teacher_id`,`course_id`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`academic_term_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`academic_term_id`) REFERENCES `academic_terms`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courses_term_code` ON `courses` (`academic_term_id`,`code`);--> statement-breakpoint
CREATE INDEX `courses_school_term` ON `courses` (`school_id`,`academic_term_id`);--> statement-breakpoint
CREATE INDEX `courses_school_name` ON `courses` (`school_id`,`name`);--> statement-breakpoint
CREATE TABLE `facilities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `facilities_school_name` ON `facilities` (`school_id`,`name`);--> statement-breakpoint
CREATE TABLE `facility_business_exceptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`facility_id` integer NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`opens_at` text,
	`closes_at` text,
	`note` text DEFAULT '' NOT NULL,
	`created_by` integer,
	`updated_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "facility_business_exceptions_status" CHECK("facility_business_exceptions"."status" IN ('open','closed','restricted')),
	CONSTRAINT "facility_business_exceptions_times" CHECK(("facility_business_exceptions"."opens_at" IS NULL AND "facility_business_exceptions"."closes_at" IS NULL) OR ("facility_business_exceptions"."opens_at" IS NOT NULL AND "facility_business_exceptions"."closes_at" IS NOT NULL AND "facility_business_exceptions"."opens_at" < "facility_business_exceptions"."closes_at"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `facility_business_exceptions_unique` ON `facility_business_exceptions` (`facility_id`,`date`,`status`,`opens_at`,`closes_at`);--> statement-breakpoint
CREATE INDEX `facility_business_exceptions_lookup` ON `facility_business_exceptions` (`facility_id`,`date`);--> statement-breakpoint
CREATE TABLE `facility_business_hours` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`facility_id` integer NOT NULL,
	`weekday` integer NOT NULL,
	`opens_at` text NOT NULL,
	`closes_at` text NOT NULL,
	`created_by` integer,
	`updated_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "facility_business_hours_weekday" CHECK("facility_business_hours"."weekday" BETWEEN 0 AND 6),
	CONSTRAINT "facility_business_hours_order" CHECK("facility_business_hours"."opens_at" < "facility_business_hours"."closes_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `facility_business_hours_unique` ON `facility_business_hours` (`facility_id`,`weekday`,`opens_at`,`closes_at`);--> statement-breakpoint
CREATE INDEX `facility_business_hours_lookup` ON `facility_business_hours` (`facility_id`,`weekday`);--> statement-breakpoint
CREATE TABLE `facility_status_overrides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`facility_id` integer NOT NULL,
	`status` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`reason` text DEFAULT '' NOT NULL,
	`created_by` integer NOT NULL,
	`updated_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "facility_status_overrides_status" CHECK("facility_status_overrides"."status" IN ('open','closed','restricted')),
	CONSTRAINT "facility_status_overrides_order" CHECK("facility_status_overrides"."ends_at" IS NULL OR "facility_status_overrides"."starts_at" < "facility_status_overrides"."ends_at")
);
--> statement-breakpoint
CREATE INDEX `facility_status_overrides_active` ON `facility_status_overrides` (`facility_id`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE TABLE `passkeys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`credential_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`public_key` text NOT NULL,
	`counter` integer NOT NULL,
	`transports` text NOT NULL,
	`name` text NOT NULL,
	`device_type` text NOT NULL,
	`backed_up` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `passkeys_credential_id_unique` ON `passkeys` (`credential_id`);--> statement-breakpoint
CREATE INDEX `passkeys_user` ON `passkeys` (`user_id`);--> statement-breakpoint
CREATE TABLE `resource_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`resource_id` integer NOT NULL,
	`r2_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`page_count` integer,
	`extraction_status` text DEFAULT 'pending' NOT NULL,
	`extraction_error` text DEFAULT '' NOT NULL,
	`extracted_text` text DEFAULT '' NOT NULL,
	`extracted_at` integer,
	`uploaded_by` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "resource_files_size" CHECK("resource_files"."size" >= 0),
	CONSTRAINT "resource_files_extraction_status" CHECK("resource_files"."extraction_status" IN ('pending','processing','completed','failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_files_r2_key_unique` ON `resource_files` (`r2_key`);--> statement-breakpoint
CREATE INDEX `resource_files_resource` ON `resource_files` (`resource_id`);--> statement-breakpoint
CREATE INDEX `resource_files_extraction` ON `resource_files` (`extraction_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `resource_files_resource_hash` ON `resource_files` (`resource_id`,`sha256`);--> statement-breakpoint
CREATE TABLE `resource_search_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`resource_id` integer NOT NULL,
	`school_id` integer NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`extracted_text` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_search_documents_resource_id_unique` ON `resource_search_documents` (`resource_id`);--> statement-breakpoint
CREATE INDEX `resource_search_documents_school` ON `resource_search_documents` (`school_id`);--> statement-breakpoint
CREATE INDEX `resource_search_documents_resource` ON `resource_search_documents` (`resource_id`);--> statement-breakpoint
CREATE TABLE `resources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`facility_id` integer,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`external_url` text DEFAULT '' NOT NULL,
	`location_note` text DEFAULT '' NOT NULL,
	`published_at` integer,
	`effective_from` integer,
	`effective_to` integer,
	`starts_at` integer,
	`ends_at` integer,
	`created_by` integer NOT NULL,
	`updated_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "resources_kind" CHECK("resources"."kind" IN ('rule','career','event','other')),
	CONSTRAINT "resources_effective_dates" CHECK("resources"."effective_to" IS NULL OR "resources"."effective_from" IS NULL OR "resources"."effective_from" <= "resources"."effective_to"),
	CONSTRAINT "resources_event_dates" CHECK("resources"."ends_at" IS NULL OR "resources"."starts_at" IS NULL OR "resources"."starts_at" <= "resources"."ends_at")
);
--> statement-breakpoint
CREATE INDEX `resources_school_kind_date` ON `resources` (`school_id`,`kind`,`starts_at`);--> statement-breakpoint
CREATE INDEX `resources_facility` ON `resources` (`facility_id`);--> statement-breakpoint
CREATE TABLE `schedule_exceptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`course_schedule_id` integer,
	`period_id` integer,
	`facility_id` integer,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`starts_at` text,
	`ends_at` text,
	`location_note` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` integer NOT NULL,
	`updated_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_schedule_id`) REFERENCES `course_schedules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`period_id`) REFERENCES `school_periods`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "schedule_exceptions_kind" CHECK("schedule_exceptions"."kind" IN ('cancelled','makeup','rescheduled','room_changed')),
	CONSTRAINT "schedule_exceptions_times" CHECK(("schedule_exceptions"."starts_at" IS NULL AND "schedule_exceptions"."ends_at" IS NULL) OR ("schedule_exceptions"."starts_at" IS NOT NULL AND "schedule_exceptions"."ends_at" IS NOT NULL AND "schedule_exceptions"."starts_at" < "schedule_exceptions"."ends_at"))
);
--> statement-breakpoint
CREATE INDEX `schedule_exceptions_course_date` ON `schedule_exceptions` (`course_id`,`date`);--> statement-breakpoint
CREATE INDEX `schedule_exceptions_schedule_date` ON `schedule_exceptions` (`course_schedule_id`,`date`);--> statement-breakpoint
CREATE TABLE `school_periods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`period_number` integer NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "school_periods_positive" CHECK("school_periods"."period_number" > 0),
	CONSTRAINT "school_periods_order" CHECK("school_periods"."starts_at" < "school_periods"."ends_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `school_periods_number` ON `school_periods` (`school_id`,`period_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `school_periods_time` ON `school_periods` (`school_id`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE TABLE `schools` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`timezone` text DEFAULT 'Asia/Tokyo' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schools_code_ci` ON `schools` (lower("code"));--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` integer NOT NULL,
	`scope` text NOT NULL,
	`auth_version` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sessions_scope" CHECK("sessions"."scope" IN ('enroll','full'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expiry` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `student_private_details` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`full_name` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_private_details_student_id_unique` ON `student_private_details` (`student_id`);--> statement-breakpoint
CREATE INDEX `student_private_details_student` ON `student_private_details` (`student_id`);--> statement-breakpoint
CREATE TABLE `student_tag_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `student_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_tag_assignments_unique` ON `student_tag_assignments` (`student_id`,`tag_id`);--> statement-breakpoint
CREATE INDEX `student_tag_assignments_tag` ON `student_tag_assignments` (`tag_id`,`student_id`);--> statement-breakpoint
CREATE TABLE `student_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_tags_school_name` ON `student_tags` (`school_id`,`name`);--> statement-breakpoint
CREATE INDEX `student_tags_school` ON `student_tags` (`school_id`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`student_number` text NOT NULL,
	`personality` text DEFAULT '' NOT NULL,
	`considerations` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_school_number` ON `students` (`school_id`,`student_number`);--> statement-breakpoint
CREATE INDEX `students_school` ON `students` (`school_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`role` text NOT NULL,
	`password_hash` text,
	`password_expires_at` integer,
	`auth_version` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "users_role" CHECK("users"."role" IN ('super_admin','admin','general')),
	CONSTRAINT "users_role_school" CHECK(("users"."role" = 'super_admin' AND "users"."school_id" IS NULL) OR ("users"."role" IN ('admin','general') AND "users"."school_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_ci` ON `users` (lower("username"));--> statement-breakpoint
CREATE INDEX `users_school_role` ON `users` (`school_id`,`role`);
--> statement-breakpoint
CREATE VIRTUAL TABLE resource_search USING fts5(
  title,
  category,
  body,
  extracted_text,
  content='resource_search_documents',
  content_rowid='id',
  tokenize='unicode61'
);
--> statement-breakpoint
CREATE TRIGGER resource_search_documents_ai AFTER INSERT ON resource_search_documents BEGIN
  INSERT INTO resource_search(rowid, title, category, body, extracted_text)
  VALUES (new.id, new.title, new.category, new.body, new.extracted_text);
END;
--> statement-breakpoint
CREATE TRIGGER resource_search_documents_ad AFTER DELETE ON resource_search_documents BEGIN
  INSERT INTO resource_search(resource_search, rowid, title, category, body, extracted_text)
  VALUES ('delete', old.id, old.title, old.category, old.body, old.extracted_text);
END;
--> statement-breakpoint
CREATE TRIGGER resource_search_documents_au AFTER UPDATE ON resource_search_documents BEGIN
  INSERT INTO resource_search(resource_search, rowid, title, category, body, extracted_text)
  VALUES ('delete', old.id, old.title, old.category, old.body, old.extracted_text);
  INSERT INTO resource_search(rowid, title, category, body, extracted_text)
  VALUES (new.id, new.title, new.category, new.body, new.extracted_text);
END;
--> statement-breakpoint
CREATE TRIGGER courses_school_guard BEFORE INSERT ON courses
WHEN (SELECT school_id FROM academic_terms WHERE id = new.academic_term_id) <> new.school_id
BEGIN SELECT RAISE(ABORT, 'academic term belongs to another school'); END;
--> statement-breakpoint
CREATE TRIGGER course_teachers_school_guard BEFORE INSERT ON course_teachers
WHEN (SELECT school_id FROM courses WHERE id = new.course_id) IS NOT
     (SELECT school_id FROM users WHERE id = new.teacher_id)
BEGIN SELECT RAISE(ABORT, 'teacher belongs to another school'); END;
--> statement-breakpoint
CREATE TRIGGER course_enrollments_school_guard BEFORE INSERT ON course_enrollments
WHEN (SELECT school_id FROM courses WHERE id = new.course_id) <>
     (SELECT school_id FROM students WHERE id = new.student_id)
BEGIN SELECT RAISE(ABORT, 'student belongs to another school'); END;
--> statement-breakpoint
CREATE TRIGGER student_tag_assignments_school_guard BEFORE INSERT ON student_tag_assignments
WHEN (SELECT school_id FROM students WHERE id = new.student_id) <>
     (SELECT school_id FROM student_tags WHERE id = new.tag_id)
BEGIN SELECT RAISE(ABORT, 'tag belongs to another school'); END;
--> statement-breakpoint
CREATE TRIGGER course_schedules_school_guard BEFORE INSERT ON course_schedules
WHEN (SELECT school_id FROM courses WHERE id = new.course_id) <>
     (SELECT school_id FROM school_periods WHERE id = new.period_id)
  OR (new.facility_id IS NOT NULL AND
      (SELECT school_id FROM courses WHERE id = new.course_id) <>
      (SELECT school_id FROM facilities WHERE id = new.facility_id))
BEGIN SELECT RAISE(ABORT, 'schedule relation belongs to another school'); END;
--> statement-breakpoint
CREATE TRIGGER schedule_exceptions_school_guard BEFORE INSERT ON schedule_exceptions
WHEN (new.course_schedule_id IS NOT NULL AND
      (SELECT course_id FROM course_schedules WHERE id = new.course_schedule_id) <> new.course_id)
  OR (new.period_id IS NOT NULL AND
      (SELECT school_id FROM courses WHERE id = new.course_id) <>
      (SELECT school_id FROM school_periods WHERE id = new.period_id))
  OR (new.facility_id IS NOT NULL AND
      (SELECT school_id FROM courses WHERE id = new.course_id) <>
      (SELECT school_id FROM facilities WHERE id = new.facility_id))
BEGIN SELECT RAISE(ABORT, 'schedule exception relation is invalid'); END;
--> statement-breakpoint
CREATE TRIGGER course_sessions_relation_guard BEFORE INSERT ON course_sessions
WHEN (new.course_schedule_id IS NOT NULL AND
      (SELECT course_id FROM course_schedules WHERE id = new.course_schedule_id) <> new.course_id)
  OR (new.schedule_exception_id IS NOT NULL AND
      (SELECT course_id FROM schedule_exceptions WHERE id = new.schedule_exception_id) <> new.course_id)
  OR (new.period_id IS NOT NULL AND
      (SELECT school_id FROM courses WHERE id = new.course_id) <>
      (SELECT school_id FROM school_periods WHERE id = new.period_id))
  OR (new.facility_id IS NOT NULL AND
      (SELECT school_id FROM courses WHERE id = new.course_id) <>
      (SELECT school_id FROM facilities WHERE id = new.facility_id))
BEGIN SELECT RAISE(ABORT, 'course session relation is invalid'); END;
--> statement-breakpoint
CREATE TRIGGER attendance_enrollment_guard BEFORE INSERT ON attendance
WHEN NOT EXISTS (
  SELECT 1
  FROM course_sessions cs
  JOIN course_enrollments ce ON ce.course_id = cs.course_id
  WHERE cs.id = new.course_session_id
    AND ce.student_id = new.student_id
    AND ce.status = 'active'
)
BEGIN SELECT RAISE(ABORT, 'student is not actively enrolled in this course'); END;
--> statement-breakpoint
CREATE TRIGGER resources_facility_school_guard BEFORE INSERT ON resources
WHEN new.facility_id IS NOT NULL
 AND (SELECT school_id FROM facilities WHERE id = new.facility_id) <> new.school_id
BEGIN SELECT RAISE(ABORT, 'facility belongs to another school'); END;
