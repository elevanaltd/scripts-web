-- 1. Check user profile
SELECT 
    up.id,
    up.email,
    up.role,
    up.display_name
FROM public.user_profiles up
WHERE up.email = 'shaun.buswell@elevana.com';

-- 2. Check specific project
SELECT 
    id,
    title,
    eav_code,
    client_filter,
    project_phase
FROM public.projects
WHERE id = '68acab201777220d9e378d1d';

-- 3. Check if that project has videos
SELECT COUNT(*) as video_count
FROM public.videos
WHERE eav_code = 'EAV006';

-- 4. Test get_user_role function
SELECT get_user_role() as current_role;
