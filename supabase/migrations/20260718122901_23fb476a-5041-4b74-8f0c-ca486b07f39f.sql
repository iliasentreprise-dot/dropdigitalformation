
ALTER TABLE public.bot_followup_schedule DROP CONSTRAINT bot_followup_schedule_student_id_fkey,
  ADD CONSTRAINT bot_followup_schedule_student_id_fkey FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_presence DROP CONSTRAINT user_presence_user_id_fkey,
  ADD CONSTRAINT user_presence_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.moderator_sales DROP CONSTRAINT moderator_sales_moderator_id_fkey,
  ADD CONSTRAINT moderator_sales_moderator_id_fkey FOREIGN KEY (moderator_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.moderator_resources DROP CONSTRAINT moderator_resources_moderator_id_fkey,
  ADD CONSTRAINT moderator_resources_moderator_id_fkey FOREIGN KEY (moderator_id) REFERENCES auth.users(id) ON DELETE CASCADE;
