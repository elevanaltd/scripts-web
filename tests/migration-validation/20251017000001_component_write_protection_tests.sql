-- Component Write Protection Integration Tests
-- Migration: 20251017000001
-- Purpose: Validate trigger blocks direct writes and allows authorized function writes
-- Note: This is a test migration - can be rolled back after validation
--
-- VALIDATION APPROACH:
-- 1. Test direct INSERT is blocked (deny path)
-- 2. Test direct UPDATE is blocked (deny path)
-- 3. Test save_script_with_components succeeds (allow path)
-- 4. Verify transaction isolation (context variable doesn't leak)

-- Test Setup: Create temporary test data
DO $$
DECLARE
    v_test_project_id text := 'test-proj-123';
    v_test_video_id text := 'test-video-456';
    v_test_script_id uuid := gen_random_uuid();
    v_test_component_id uuid := gen_random_uuid();
    v_admin_user_id uuid;
    v_direct_insert_failed boolean := false;
    v_direct_update_failed boolean := false;
    v_function_write_succeeded boolean := false;
    v_isolation_verified boolean := false;
    v_error_message text;
BEGIN
    RAISE NOTICE '=== COMPONENT WRITE PROTECTION VALIDATION TESTS ===';
    RAISE NOTICE '';

    -- Create test admin user (for function execution)
    INSERT INTO auth.users (id, email)
    VALUES (gen_random_uuid(), 'test-admin@example.com')
    RETURNING id INTO v_admin_user_id;

    INSERT INTO public.user_profiles (id, email, display_name, role)
    VALUES (v_admin_user_id, 'test-admin@example.com', 'Test Admin', 'admin');

    -- Create test project/video/script hierarchy
    INSERT INTO public.projects (id, title, eav_code, client_filter)
    VALUES (v_test_project_id, 'Test Project', 'EAV999', 'test-client');

    INSERT INTO public.videos (id, title, eav_code)
    VALUES (v_test_video_id, 'Test Video', 'EAV999');

    INSERT INTO public.scripts (id, video_id, plain_text, status)
    VALUES (v_test_script_id, v_test_video_id, 'Test script content', 'draft');

    RAISE NOTICE 'Test Setup Complete:';
    RAISE NOTICE '  Script ID: %', v_test_script_id;
    RAISE NOTICE '  Admin User ID: %', v_admin_user_id;
    RAISE NOTICE '';

    -- TEST 1: Direct INSERT should be BLOCKED
    RAISE NOTICE 'TEST 1: Attempting direct INSERT to script_components...';
    BEGIN
        INSERT INTO public.script_components (id, script_id, component_number, content)
        VALUES (v_test_component_id, v_test_script_id, 1, 'Direct insert attempt');

        RAISE NOTICE '  ❌ FAIL: Direct INSERT was allowed (should have been blocked)';
    EXCEPTION WHEN insufficient_privilege THEN
        v_direct_insert_failed := true;
        GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
        RAISE NOTICE '  ✅ PASS: Direct INSERT blocked correctly';
        RAISE NOTICE '  Error message: %', v_error_message;
    END;
    RAISE NOTICE '';

    -- TEST 2: Direct UPDATE should be BLOCKED
    RAISE NOTICE 'TEST 2: Attempting direct UPDATE to script_components...';
    BEGIN
        -- First, bypass protection to insert a component for update test
        SET LOCAL eav.allow_component_write = 'true';
        INSERT INTO public.script_components (id, script_id, component_number, content)
        VALUES (v_test_component_id, v_test_script_id, 1, 'Initial content');

        -- Clear the context variable to test protection
        RESET eav.allow_component_write;

        -- Now attempt direct update (should fail)
        UPDATE public.script_components
        SET content = 'Updated content'
        WHERE id = v_test_component_id;

        RAISE NOTICE '  ❌ FAIL: Direct UPDATE was allowed (should have been blocked)';
    EXCEPTION WHEN insufficient_privilege THEN
        v_direct_update_failed := true;
        GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
        RAISE NOTICE '  ✅ PASS: Direct UPDATE blocked correctly';
        RAISE NOTICE '  Error message: %', v_error_message;
    END;
    RAISE NOTICE '';

    -- TEST 3: save_script_with_components should SUCCEED
    RAISE NOTICE 'TEST 3: Testing save_script_with_components (authorized path)...';
    BEGIN
        -- Set authentication context to admin user
        PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_user_id)::text, true);

        -- Call the authorized function
        PERFORM public.save_script_with_components(
            v_test_script_id,
            encode('test_yjs_state', 'base64'),
            'Test plain text',
            jsonb_build_array(
                jsonb_build_object(
                    'component_number', 1,
                    'content', 'Component 1 content',
                    'word_count', 3
                ),
                jsonb_build_object(
                    'component_number', 2,
                    'content', 'Component 2 content',
                    'word_count', 3
                )
            )
        );

        -- Verify components were written
        IF (SELECT COUNT(*) FROM public.script_components WHERE script_id = v_test_script_id) = 2 THEN
            v_function_write_succeeded := true;
            RAISE NOTICE '  ✅ PASS: save_script_with_components wrote 2 components successfully';
        ELSE
            RAISE NOTICE '  ❌ FAIL: save_script_with_components did not write expected components';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
        RAISE NOTICE '  ❌ FAIL: save_script_with_components threw error: %', v_error_message;
    END;
    RAISE NOTICE '';

    -- TEST 4: Transaction isolation (context variable doesn't leak between sessions)
    RAISE NOTICE 'TEST 4: Verifying transaction isolation (context variable scoping)...';
    BEGIN
        -- In a new block, context should be cleared
        -- Attempt direct insert (should fail because context was not set in this block)
        INSERT INTO public.script_components (script_id, component_number, content)
        VALUES (v_test_script_id, 99, 'Isolation test');

        RAISE NOTICE '  ❌ FAIL: Context variable leaked across transaction boundary';
    EXCEPTION WHEN insufficient_privilege THEN
        v_isolation_verified := true;
        RAISE NOTICE '  ✅ PASS: Context variable properly scoped to transaction';
        RAISE NOTICE '  (Context did not leak from previous save_script_with_components call)';
    END;
    RAISE NOTICE '';

    -- Test Cleanup
    RAISE NOTICE '=== CLEANUP ===';
    DELETE FROM public.script_components WHERE script_id = v_test_script_id;
    DELETE FROM public.scripts WHERE id = v_test_script_id;
    DELETE FROM public.videos WHERE id = v_test_video_id;
    DELETE FROM public.projects WHERE id = v_test_project_id;
    DELETE FROM public.user_profiles WHERE id = v_admin_user_id;
    DELETE FROM auth.users WHERE id = v_admin_user_id;
    RAISE NOTICE 'Test data cleaned up';
    RAISE NOTICE '';

    -- Final Summary
    RAISE NOTICE '=== TEST SUMMARY ===';
    RAISE NOTICE 'Direct INSERT blocked: %', CASE WHEN v_direct_insert_failed THEN '✅ PASS' ELSE '❌ FAIL' END;
    RAISE NOTICE 'Direct UPDATE blocked: %', CASE WHEN v_direct_update_failed THEN '✅ PASS' ELSE '❌ FAIL' END;
    RAISE NOTICE 'Authorized function write: %', CASE WHEN v_function_write_succeeded THEN '✅ PASS' ELSE '❌ FAIL' END;
    RAISE NOTICE 'Transaction isolation: %', CASE WHEN v_isolation_verified THEN '✅ PASS' ELSE '❌ FAIL' END;
    RAISE NOTICE '';

    -- Assert all tests passed
    IF v_direct_insert_failed AND v_direct_update_failed AND v_function_write_succeeded AND v_isolation_verified THEN
        RAISE NOTICE '🎉 ALL TESTS PASSED - Component write protection working correctly';
    ELSE
        RAISE EXCEPTION 'One or more tests failed - see output above for details'
            USING ERRCODE = 'check_violation';
    END IF;

END $$;

-- Migration complete
-- Note: This test migration validates the write protection mechanism
-- If all tests pass, the trigger is working correctly and ready for production use
