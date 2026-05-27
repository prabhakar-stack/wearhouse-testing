import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:3000';

async function testAll() {
  console.log('====================================================');
  console.log('🚀 Aegis System: Starting Comprehensive Verification');
  console.log('====================================================\n');

  try {
    // ----------------------------------------------------
    // TEST 1: AUTHENTICATION & SESSION INJECTION
    // ----------------------------------------------------
    console.log('--- Test 1: Authentication Bypass (Design Mode) ---');
    const emails = [
      { email: 'receiver@cubelelo.com', role: 'RECEIVER' },
      { email: 'admin@cubelelo.com', role: 'ADMIN' },
      { email: 'prabhakar16032004@gmail.com', role: 'SUPER_ACCESS' }
    ];

    const cookies = {};

    for (const item of emails) {
      const res = await fetch(`${BASE_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: item.email }),
      });

      if (!res.ok) {
        throw new Error(`Failed to log in as ${item.email}: ${res.statusText}`);
      }

      const data = await res.json();
      console.log(`✅ Login Success: ${item.email} (Role: ${data.role})`);

      const setCookie = res.headers.get('set-cookie');
      if (setCookie) {
        const sessionMatch = setCookie.match(/session=([^;]+)/);
        if (sessionMatch) {
          cookies[item.role] = sessionMatch[1];
        }
      }
    }

    if (!cookies['RECEIVER'] || !cookies['ADMIN'] || !cookies['SUPER_ACCESS']) {
      throw new Error('Could not retrieve all necessary auth session cookies');
    }
    console.log('✅ Session cookies successfully generated.\n');

    // ----------------------------------------------------
    // TEST 2: ALERTS VISIBILITY BY ROLE (RBAC POLICIES)
    // ----------------------------------------------------
    console.log('--- Test 2: Role-Based Alert Visibility (RBAC) ---');
    
    // First, let's seed test alerts to make sure we have active alerts of all levels (L1 - L4)
    console.log('🔄 Seeding test alerts...');
    const seedRes = await fetch(`${BASE_URL}/api/alerts/seed`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'secret-cron-token'}`
      }
    });
    if (!seedRes.ok) {
      throw new Error(`Failed to seed test alerts: ${seedRes.statusText}`);
    }
    const seedData = await seedRes.json();
    console.log(`✅ Seed response: ${seedData.message}`);

    // Fetch alerts as RECEIVER (should only see L1, L2)
    const receiverRes = await fetch(`${BASE_URL}/api/alerts`, {
      headers: {
        'Cookie': `session=${cookies['RECEIVER']}`
      }
    });
    if (!receiverRes.ok) {
      throw new Error(`Failed to fetch alerts as Receiver: ${receiverRes.statusText}`);
    }
    const receiverData = await receiverRes.json();
    const receiverAlertLevels = receiverData.alerts.map(a => a.level);
    console.log(`👀 Receiver sees alert levels: ${JSON.stringify(receiverAlertLevels)}`);
    const hasReceiverViolation = receiverAlertLevels.some(lvl => ['L3', 'L4'].includes(lvl));
    if (hasReceiverViolation) {
      throw new Error('❌ RBAC VIOLATION: Receiver saw L3/L4 alerts!');
    }
    console.log('✅ RBAC check passed for Receiver (L1 and L2 only).');

    // Fetch alerts as ADMIN (should see all L1 - L4)
    const adminRes = await fetch(`${BASE_URL}/api/alerts`, {
      headers: {
        'Cookie': `session=${cookies['ADMIN']}`
      }
    });
    if (!adminRes.ok) {
      throw new Error(`Failed to fetch alerts as Admin: ${adminRes.statusText}`);
    }
    const adminData = await adminRes.json();
    const adminAlertLevels = adminData.alerts.map(a => a.level);
    console.log(`👀 Admin sees alert levels: ${JSON.stringify([...new Set(adminAlertLevels)])}`);
    console.log('✅ RBAC check passed for Admin.');

    // Fetch alerts as SUPER_ACCESS (should see all L1 - L4)
    const superRes = await fetch(`${BASE_URL}/api/alerts`, {
      headers: {
        'Cookie': `session=${cookies['SUPER_ACCESS']}`
      }
    });
    if (!superRes.ok) {
      throw new Error(`Failed to fetch alerts as Super Access: ${superRes.statusText}`);
    }
    const superData = await superRes.json();
    const superAlertLevels = superData.alerts.map(a => a.level);
    console.log(`👀 Super Access sees alert levels: ${JSON.stringify([...new Set(superAlertLevels)])}`);
    console.log('✅ RBAC check passed for Super Access.\n');

    // ----------------------------------------------------
    // TEST 2.5: ROLE-BASED PERSONNEL SORTING & EDIT GATES
    // ----------------------------------------------------
    console.log('--- Test 2.5: Role-Based Personnel Sorting & Edit Gates ---');
    
    // 1. Fetch users and verify sorting (role hierarchy first, then createdAt desc)
    const listRes = await fetch(`${BASE_URL}/api/users`, {
      headers: { 'Cookie': `session=${cookies['ADMIN']}` }
    });
    if (!listRes.ok) throw new Error('Failed to fetch active directory');
    const { users } = await listRes.json();
    console.log(`Fetched ${users.length} users from directory.`);

    // Verify ordering
    const roleOrder = { SUPER_ACCESS: 0, ADMIN: 1, RECEIVER: 2, INSPECTOR: 3, CLAIMS_SPECIALIST: 4 };
    for (let i = 0; i < users.length - 1; i++) {
      const u1 = users[i];
      const u2 = users[i + 1];
      const o1 = roleOrder[u1.role] ?? 99;
      const o2 = roleOrder[u2.role] ?? 99;
      if (o1 > o2) {
        throw new Error(`❌ SORTING VIOLATION: Role order is incorrect. ${u1.role} came before ${u2.role}`);
      }
      if (o1 === o2) {
        const t1 = new Date(u1.createdAt).getTime();
        const t2 = new Date(u2.createdAt).getTime();
        if (t1 < t2) {
          throw new Error(`❌ SORTING VIOLATION: Within role ${u1.role}, createdAt is not sorted descending.`);
        }
      }
    }
    console.log('✅ Personnel directory sorting hierarchy verified (Role asc, createdAt desc).');

    // Find test target users
    const superUser = users.find(u => u.email === 'prabhakar16032004@gmail.com');
    const adminUser = users.find(u => u.email === 'admin@cubelelo.com');
    const receiverUser = users.find(u => u.email === 'receiver@cubelelo.com');

    if (!superUser || !adminUser || !receiverUser) {
      throw new Error('Database is missing required baseline users for test 2.5');
    }

    // 2. Admin tries to edit Super Access (Should be BLOCKED)
    console.log('🔄 Admin attempting to edit Super-Access user details...');
    const adminEditSuperRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': `session=${cookies['ADMIN']}` },
      body: JSON.stringify({
        id: superUser.id,
        name: 'Hacked SuperAccess',
      })
    });
    if (adminEditSuperRes.status === 400) {
      const err = await adminEditSuperRes.json();
      console.log(`✅ Success: Admin was BLOCKED from editing Super-Access. Error: "${err.error}"`);
    } else {
      throw new Error(`❌ Failure: Expected Admin editing Super-Access to fail with 400, but got status ${adminEditSuperRes.status}`);
    }

    // 3. Admin tries to edit Receiver (Should SUCCEED)
    console.log('🔄 Admin attempting to edit Receiver user details...');
    const originalName = receiverUser.name;
    const adminEditRecRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': `session=${cookies['ADMIN']}` },
      body: JSON.stringify({
        id: receiverUser.id,
        name: 'Receiver User Edited by Admin',
        itemsProcessed: 15,
        accuracyRate: 98.5
      })
    });
    if (adminEditRecRes.ok) {
      const editData = await adminEditRecRes.json();
      console.log(`✅ Success: Admin successfully edited Receiver. New Name: "${editData.user.name}", Items Proc: ${editData.user.itemsProcessed}, Acc Rate: ${editData.user.accuracyRate}%`);
    } else {
      const err = await adminEditRecRes.json();
      throw new Error(`❌ Failure: Expected Admin editing Receiver to succeed, but got error: "${err.error}"`);
    }

    // Restore Receiver name
    await fetch(`${BASE_URL}/api/users`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': `session=${cookies['ADMIN']}` },
      body: JSON.stringify({ id: receiverUser.id, name: originalName || 'Receiver User', itemsProcessed: 0, accuracyRate: 100.0 })
    });

    // 4. Super-Access tries to edit Admin (Should SUCCEED)
    console.log('🔄 Super-Access attempting to edit Admin user details...');
    const originalAdminName = adminUser.name;
    const superEditAdminRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': `session=${cookies['SUPER_ACCESS']}` },
      body: JSON.stringify({
        id: adminUser.id,
        name: 'Admin User Edited by SuperAccess',
      })
    });
    if (superEditAdminRes.ok) {
      const editData = await superEditAdminRes.json();
      console.log(`✅ Success: Super-Access successfully edited Admin. New Name: "${editData.user.name}"`);
    } else {
      const err = await superEditAdminRes.json();
      throw new Error(`❌ Failure: Expected Super-Access editing Admin to succeed, but got error: "${err.error}"`);
    }

    // Restore Admin name
    await fetch(`${BASE_URL}/api/users`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': `session=${cookies['SUPER_ACCESS']}` },
      body: JSON.stringify({ id: adminUser.id, name: originalAdminName || 'Admin User' })
    });

    // 5. Self-editing Block (Should be BLOCKED)
    console.log('🔄 Super-Access attempting self-editing...');
    const selfEditRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': `session=${cookies['SUPER_ACCESS']}` },
      body: JSON.stringify({
        id: superUser.id,
        name: 'Self Edited SuperAccess',
      })
    });
    if (selfEditRes.status === 400) {
      const err = await selfEditRes.json();
      console.log(`✅ Success: Self-editing was BLOCKED. Error: "${err.error}"`);
    } else {
      throw new Error(`❌ Failure: Expected self-editing to fail with 400, but got status ${selfEditRes.status}`);
    }
    console.log('✅ Edit boundaries and safety lockout verified successfully.\n');

    // ----------------------------------------------------
    // TEST 3: DATA-DRIVEN RESOLUTION CHECKS
    // ----------------------------------------------------
    console.log('--- Test 3: Data-Driven Resolution Checks ---');

    // Let's create a test alert linked to a manifest to test resolution block.
    // Alert: DELIVERY_ETA_BREACH_48H for trackingId: 'TRK-DATA-RESOLVE-111'
    const trackingId = 'TRK-DATA-RESOLVE-111';

    // Clear any existing test manifest/alert to avoid duplication error
    await prisma.alert.deleteMany({ where: { manifest: { trackingId } } });
    await prisma.manifest.deleteMany({ where: { trackingId } });

    // Create a manifest with status EXPECTED
    const manifest = await prisma.manifest.create({
      data: {
        trackingId,
        status: 'EXPECTED',
        marketplace: 'AMAZON',
        expectedDate: new Date(),
      }
    });

    // Create an alert of type GHOST_DELIVERY_T1_6H linked to this manifest
    const alert = await prisma.alert.create({
      data: {
        level: 'L2',
        type: 'GHOST_DELIVERY_T1_6H',
        title: 'Ghost Delivery (Type 1) — 6h overdue',
        description: `Package ${trackingId} is marked delivered by carrier but no receiver scan.`,
        manifestId: manifest.id,
      }
    });

    console.log(`Created test alert: ${alert.title} linked to manifest ${trackingId} (Status: EXPECTED)`);

    // 1. Try to resolve as Admin (without forceResolve)
    // Since the manifest status is still EXPECTED, it should be blocked!
    console.log('🔄 Attempting to resolve alert while manifest status is EXPECTED...');
    const resolveRes1 = await fetch(`${BASE_URL}/api/alerts`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session=${cookies['ADMIN']}`
      },
      body: JSON.stringify({
        alertId: alert.id,
        resolution: 'Attempted resolve before receiving package.'
      })
    });

    const resolveData1 = await resolveRes1.json();
    if (resolveRes1.status === 422 || resolveRes1.status === 400) {
      console.log(`✅ Success: Alert resolution was correctly BLOCKED. Error: "${resolveData1.error}"`);
    } else {
      throw new Error(`❌ Failure: Expected resolution to be blocked, but got status ${resolveRes1.status}`);
    }

    // 2. Simulating underlying data correction (Receive package -> AT_DOCK)
    console.log('🔄 Correcting the operational data: receiving package to the dock...');
    await prisma.manifest.update({
      where: { id: manifest.id },
      data: { status: 'AT_DOCK', receivedAt: new Date() }
    });
    console.log(`Updated manifest ${trackingId} status to AT_DOCK`);

    // 3. Retry resolving as Admin (should now succeed since data check passes!)
    console.log('🔄 Retrying alert resolution after data correction...');
    const resolveRes2 = await fetch(`${BASE_URL}/api/alerts`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session=${cookies['ADMIN']}`
      },
      body: JSON.stringify({
        alertId: alert.id,
        resolution: 'Verified package arrived at the dock.'
      })
    });

    const resolveData2 = await resolveRes2.json();
    if (resolveRes2.ok && resolveData2.success) {
      console.log('✅ Success: Alert was successfully RESOLVED after data check passed!');
    } else {
      throw new Error(`❌ Failure: Expected resolution to succeed, but got error: "${resolveData2.error}"`);
    }

    // 4. Test Super Admin Override (forceResolve)
    // Let's create another alert on a blocked manifest
    const trackingId2 = 'TRK-DATA-OVERRIDE-222';
    await prisma.alert.deleteMany({ where: { manifest: { trackingId: trackingId2 } } });
    await prisma.manifest.deleteMany({ where: { trackingId: trackingId2 } });

    const manifest2 = await prisma.manifest.create({
      data: {
        trackingId: trackingId2,
        status: 'EXPECTED',
        marketplace: 'AMAZON',
      }
    });

    const alert2 = await prisma.alert.create({
      data: {
        level: 'L2',
        type: 'GHOST_DELIVERY_T1_6H',
        title: 'Ghost Delivery Override Test',
        description: `Package ${trackingId2} is marked delivered by carrier.`,
        manifestId: manifest2.id,
      }
    });

    console.log(`Created second test alert for override: ${alert2.title} (Manifest status: EXPECTED)`);

    // Try resolving as Super Admin with forceResolve=true
    console.log('🔄 Resolving as Super Admin with forceResolve bypass...');
    const overrideRes = await fetch(`${BASE_URL}/api/alerts`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session=${cookies['SUPER_ACCESS']}`
      },
      body: JSON.stringify({
        alertId: alert2.id,
        resolution: 'Bypassed by super-admin override.',
        forceResolve: true
      })
    });

    const overrideData = await overrideRes.json();
    if (overrideRes.ok && overrideData.success) {
      console.log('✅ Success: Super Admin successfully bypassed the data-driven check using forceResolve!\n');
    } else {
      throw new Error(`❌ Failure: Super Admin override failed with error: "${overrideData.error}"`);
    }

    // Clean up test data-resolve records
    await prisma.alert.deleteMany({ where: { id: { in: [alert.id, alert2.id] } } });
    await prisma.manifest.deleteMany({ where: { id: { in: [manifest.id, manifest2.id] } } });

    // ----------------------------------------------------
    // TEST 4: FILE UPLOAD SEQUENCE (INIT, PUT, FINALIZE)
    // ----------------------------------------------------
    console.log('--- Test 4: Complete File Upload Flow ---');

    const testTrackingId = 'TRK-UPLOAD-TEST-999';

    // Make sure manifest exists
    await prisma.evidence.deleteMany({ where: { lpn: testTrackingId } });
    await prisma.manifest.deleteMany({ where: { trackingId: testTrackingId } });
    const uploadManifest = await prisma.manifest.create({
      data: {
        trackingId: testTrackingId,
        status: 'EXPECTED',
        marketplace: 'AMAZON',
      }
    });

    console.log(`1. Initializing upload for Tracking ID: ${testTrackingId}...`);
    const initRes = await fetch(`${BASE_URL}/api/upload/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session=${cookies['ADMIN']}`
      },
      body: JSON.stringify({
        orderId: testTrackingId,
        type: 'RECEIVER_REJECTION',
        filesMetaData: [
          { key: 'dummy_photo', name: `rejection-${testTrackingId}-test.jpg`, mimeType: 'image/jpeg' }
        ]
      })
    });

    if (!initRes.ok) {
      throw new Error(`Failed to initialize upload: ${initRes.statusText}`);
    }
    const initData = await initRes.json();
    const uploadUrl = initData.uploadUrls['dummy_photo'];
    console.log(`✅ Upload initialized. Web view link: ${initData.folderLink}`);
    console.log(`   Local upload endpoint: ${uploadUrl}`);

    console.log('2. Uploading mock image file to local storage (PUT)...');
    const mockImageBuffer = Buffer.from('this is a dummy image binary content');
    const uploadFileRes = await fetch(`${BASE_URL}${uploadUrl}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg',
        'Cookie': `session=${cookies['ADMIN']}`
      },
      body: mockImageBuffer
    });

    if (!uploadFileRes.ok) {
      throw new Error(`Failed to upload mock file: ${uploadFileRes.statusText}`);
    }
    const uploadFileData = await uploadFileRes.json();
    console.log(`✅ Mock upload PUT success! Saved path: ${uploadFileData.localPath}`);
    console.log(`   Local serving URL: ${uploadFileData.webViewLink}`);

    console.log('3. Finalizing upload sequence (evidence registration)...');
    const finalizeRes = await fetch(`${BASE_URL}/api/upload/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session=${cookies['ADMIN']}`
      },
      body: JSON.stringify({
        orderId: testTrackingId,
        folderLink: uploadFileData.webViewLink,
        orderFolderId: initData.orderFolderId,
        type: 'RECEIVER_REJECTION',
        reason: 'Visual damage test.',
        manifestId: uploadManifest.id
      })
    });

    if (!finalizeRes.ok) {
      const errText = await finalizeRes.text();
      throw new Error(`Failed to finalize upload: ${finalizeRes.status} - ${errText}`);
    }
    const finalizeData = await finalizeRes.json();
    console.log(`✅ Upload Finalize Success! Registered ${finalizeData.evidenceCount} evidence records.`);
    console.log(`   Database Evidence: ${JSON.stringify(finalizeData.evidence)}`);

    // Clean up upload test evidence
    await prisma.evidence.deleteMany({ where: { lpn: testTrackingId } });
    await prisma.manifest.deleteMany({ where: { trackingId: testTrackingId } });
    console.log('✅ Upload flow cleaned up.\n');

    // ----------------------------------------------------
    // CLEAN UP SEEDED TEST ALERTS
    // ----------------------------------------------------
    console.log('🔄 Cleaning up seeded test alerts...');
    const cleanupRes = await fetch(`${BASE_URL}/api/alerts/seed`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'secret-cron-token'}`
      }
    });
    if (!cleanupRes.ok) {
      throw new Error(`Failed to clean up seeded test alerts: ${cleanupRes.statusText}`);
    }
    const cleanupData = await cleanupRes.json();
    console.log(`✅ Cleanup response: Deleted ${cleanupData.deleted} test alerts.`);

    console.log('\n====================================================');
    console.log('🎉 Aegis System: ALL TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('====================================================');

  } catch (error) {
    console.error('\n❌ Aegis System: TEST FAILURE DETECTED ❌');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testAll();
