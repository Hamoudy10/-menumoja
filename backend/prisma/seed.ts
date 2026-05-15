import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. Subscription Plans
  const starterPlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Starter',
      priceMonthlyKes: 1500,
      priceYearlyKes: 15000,
      maxMenuItems: 20,
      maxTables: 10,
      hasOrdering: true,
      hasAnalytics: false,
      hasSurveillance: false,
      hasMarketingAi: false,
      hasUssd: false,
      hasMultiBranch: false,
      isActive: true,
    },
  });

  const businessPlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Business',
      priceMonthlyKes: 3500,
      priceYearlyKes: 35000,
      maxMenuItems: 50,
      maxTables: 25,
      hasOrdering: true,
      hasAnalytics: true,
      hasSurveillance: true,
      hasMarketingAi: true,
      hasUssd: true,
      hasMultiBranch: false,
      isActive: true,
    },
  });

  await prisma.subscriptionPlan.create({
    data: {
      name: 'Premium',
      priceMonthlyKes: 7500,
      priceYearlyKes: 75000,
      hasOrdering: true,
      hasAnalytics: true,
      hasSurveillance: true,
      hasMarketingAi: true,
      hasUssd: true,
      hasMultiBranch: true,
      isActive: true,
    },
  });

  // 2. Super Admin
  const adminPassword = await bcrypt.hash('Admin@123', 12);
  await prisma.platformAdmin.create({
    data: {
      name: 'Super Admin',
      email: 'admin@menumoja.co.ke',
      passwordHash: adminPassword,
      role: 'SUPER_ADMIN',
    },
  });

  // 3. Demo Owner
  const ownerPassword = await bcrypt.hash('Owner@123', 12);
  const owner = await prisma.owner.create({
    data: {
      fullName: 'Hassan Ali',
      email: 'hassan@bahari.co.ke',
      phone: '+254712345678',
      passwordHash: ownerPassword,
      isVerified: true,
      onboardingCompleted: true,
      onboardingStep: 5,
    },
  });

  // 4. Demo Restaurant: Bahari Restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      ownerId: owner.id,
      name: 'Bahari Restaurant',
      slug: 'bahari-restaurant',
      description:
        'Experience the finest Swahili cuisine with a stunning ocean view at Bahari Restaurant. Our menu blends traditional coastal flavors with modern culinary techniques.',
      descriptionSw:
        'Pata uzoefu wa vyakula bora vya Kiswahili kwa mandhari nzuri ya bahari katika Bahari Restaurant. Menyu yetu inachanganya ladha za kitamaduni za pwani na mbinu za kisasa za upishi.',
      address: 'Moi Avenue, Next to Nyali Beach',
      city: 'Mombasa',
      latitude: -4.0435,
      longitude: 39.6682,
      phone: '+254712345678',
      whatsapp: '+254712345678',
      email: 'info@bahari.co.ke',
      website: 'https://bahari.co.ke',
      currency: 'KES',
      isHalalCertified: true,
      dietaryOptions: ['Halal', 'Vegetarian', 'Vegan', 'Gluten-Free'],
      isActive: true,
      isSuspended: false,
      planId: businessPlan.id,
      subscriptionStatus: 'ACTIVE',
      planExpiresAt: new Date('2027-01-01'),
    },
  });

  // 5. Restaurant Settings
  await prisma.restaurantSettings.create({
    data: {
      restaurantId: restaurant.id,
      primaryColor: '#1E40AF',
      secondaryColor: '#F59E0B',
      fontFamily: 'Inter',
      layoutStyle: 'GRID',
      welcomeMessage: 'Karibu! Welcome to Bahari Restaurant!',
      welcomeMessageSw: 'Karibu Bahari Restaurant!',
      announcement: 'Try our new Nyama Choma special - 10% off this week!',
      announcementActive: true,
      languageEnglish: true,
      languageSwahili: true,
      languageArabic: false,
      showPrices: true,
      allowOrdering: true,
      allowCashPayment: true,
      allowMpesaPayment: true,
      tipEnabled: true,
      tipPercentages: [5, 10, 15],
      serviceChargePercent: 5,
      taxPercent: 16,
    },
  });

  // 6. Opening Hours (Mon-Sun)
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
  for (const day of days) {
    await prisma.openingHour.create({
      data: {
        restaurantId: restaurant.id,
        dayOfWeek: day,
        openTime: '07:00',
        closeTime: day === 'SUN' ? '21:00' : '22:00',
        isClosed: false,
      },
    });
  }

  // 7. Menu Categories
  const mainsCat = await prisma.menuCategory.create({
    data: { restaurantId: restaurant.id, name: 'Main Course', nameSw: 'Mlo Mkuu', sortOrder: 1, isActive: true },
  });
  const appsCat = await prisma.menuCategory.create({
    data: { restaurantId: restaurant.id, name: 'Appetizers', nameSw: 'Vitafunio', sortOrder: 2, isActive: true },
  });
  const bevCat = await prisma.menuCategory.create({
    data: { restaurantId: restaurant.id, name: 'Beverages', nameSw: 'Vinywaji', sortOrder: 3, isActive: true },
  });

  // 8. Menu Items
  const menuItemsData = [
    {
      name: 'Nyama Choma',
      nameSw: 'Nyama Choma',
      nameAr: 'نياما تشوما',
      description: 'Grilled beef served with kachumbari and ugali',
      descriptionSw: 'Nyama ya ng\'ombe iliyochomwa ikitolewa kwa kachumbari na ugali',
      descriptionAr: 'لحم بقري مشوي يقدم مع كاشومباري وأوغالي',
      price: 850,
      categoryId: mainsCat.id,
      isHalal: true,
      spiceLevel: 'MEDIUM' as const,
      isTodaysSpecial: true,
      isFeatured: true,
      totalOrders: 450,
      ingredients: ['Beef', 'Salt', 'Pepper', 'Lemon', 'Spices'],
    },
    {
      name: 'Chicken Biryani',
      nameSw: 'Biryani ya Kuku',
      nameAr: 'برياني الدجاج',
      description: 'Fragrant basmati rice layered with spiced chicken',
      descriptionSw: 'Wali wa basmati yenye harufu nzuri iliyowekwa na kuku wa viungo',
      descriptionAr: 'أرز بسمتي عطري مع طبقات من الدجاج بالتوابل',
      price: 650,
      categoryId: mainsCat.id,
      isHalal: true,
      spiceLevel: 'MILD' as const,
      isFeatured: true,
      totalOrders: 380,
      ingredients: ['Basmati Rice', 'Chicken', 'Yogurt', 'Biryani Spices', 'Saffron'],
    },
    {
      name: 'Vegetable Pilau',
      nameSw: 'Pilau ya Mboga',
      nameAr: 'بيلاو الخضار',
      description: 'Spiced rice with mixed vegetables and pilau masala',
      descriptionSw: 'Wali wa viungo na mboga mchanganyiko na masala ya pilau',
      descriptionAr: 'أرز متبل بالخضروات المشكلة وماسالا بيلاو',
      price: 450,
      categoryId: mainsCat.id,
      isVegetarian: true,
      isVegan: true,
      isGlutenFree: true,
      spiceLevel: 'MILD' as const,
      totalOrders: 220,
      ingredients: ['Rice', 'Carrots', 'Peas', 'Potatoes', 'Pilau Masala'],
    },
    {
      name: 'Samosas',
      nameSw: 'Samosas',
      nameAr: 'سمبوسة',
      description: 'Crispy pastry filled with spiced minced meat',
      descriptionSw: 'Pastry nyororo iliyojazwa na nyama ya kusaga yenye viungo',
      descriptionAr: 'عجينة مقرمشة محشوة باللحم المفروم المتبل',
      price: 350,
      categoryId: appsCat.id,
      isHalal: true,
      spiceLevel: 'MEDIUM' as const,
      isFeatured: true,
      totalOrders: 560,
      ingredients: ['Flour', 'Minced Meat', 'Onions', 'Green Chilies', 'Coriander'],
    },
    {
      name: 'Kachumbari',
      nameSw: 'Kachumbari',
      nameAr: 'كاشومباري',
      description: 'Fresh tomato and onion salad with coriander and lime',
      descriptionSw: 'Saladi ya nyanya na vitunguu safi na coriander na limau',
      descriptionAr: 'سلطة طماطم وبصل طازجة مع كزبرة وليمون',
      price: 250,
      categoryId: appsCat.id,
      isVegetarian: true,
      isVegan: true,
      isGlutenFree: true,
      spiceLevel: 'NONE' as const,
      totalOrders: 340,
      ingredients: ['Tomatoes', 'Onions', 'Coriander', 'Lime', 'Salt'],
    },
    {
      name: 'Mango Juice',
      nameSw: 'Juisi ya Maembe',
      nameAr: 'عصير مانجو',
      description: 'Freshly squeezed sweet mango juice',
      descriptionSw: 'Juisi ya maembe matamu yaliyokamuliwa upya',
      descriptionAr: 'عصير مانجو حلو طازج',
      price: 250,
      categoryId: bevCat.id,
      isVegetarian: true,
      isVegan: true,
      isGlutenFree: true,
      spiceLevel: 'NONE' as const,
      totalOrders: 620,
      ingredients: ['Mangoes', 'Sugar', 'Water', 'Ice'],
    },
    {
      name: 'Chai Masala',
      nameSw: 'Chai Masala',
      nameAr: 'شاي ماسالا',
      description: 'Traditional spiced tea with cardamom, cinnamon, and ginger',
      descriptionSw: 'Chai ya viungo ya kitamaduni na iliki, mdalasini na tangawizi',
      descriptionAr: 'شاي تقليدي بالتوابل مع الهيل والقرفة والزنجبيل',
      price: 150,
      categoryId: bevCat.id,
      isVegetarian: true,
      isVegan: true,
      isGlutenFree: true,
      spiceLevel: 'MILD' as const,
      totalOrders: 890,
      ingredients: ['Tea', 'Milk', 'Cardamom', 'Cinnamon', 'Ginger', 'Sugar'],
    },
  ];

  for (const item of menuItemsData) {
    await prisma.menuItem.create({ data: { restaurantId: restaurant.id, ...item } });
  }

  // 9. Staff
  const staffPin = await bcrypt.hash('1234', 10);

  const mary = await prisma.staff.create({
    data: { restaurantId: restaurant.id, fullName: 'Mary Wanjiku', phone: '+254723456789', pinHash: staffPin, role: 'WAITER' },
  });
  await prisma.staff.create({
    data: { restaurantId: restaurant.id, fullName: 'Peter Kamau', phone: '+254734567890', pinHash: staffPin, role: 'KITCHEN' },
  });
  await prisma.staff.create({
    data: { restaurantId: restaurant.id, fullName: 'Grace Akinyi', phone: '+254745678901', pinHash: staffPin, role: 'CASHIER' },
  });

  // 10. Restaurant Tables (12)
  const tableConfigs = [
    { num: 1, label: 'Table 1', cap: 2 },
    { num: 2, label: 'Table 2', cap: 2 },
    { num: 3, label: 'Table 3', cap: 4 },
    { num: 4, label: 'Table 4', cap: 4 },
    { num: 5, label: 'Table 5', cap: 6 },
    { num: 6, label: 'Table 6', cap: 6 },
    { num: 7, label: 'Table 7 (Balcony)', cap: 4 },
    { num: 8, label: 'Table 8 (Balcony)', cap: 4 },
    { num: 9, label: 'Table 9 (Balcony)', cap: 6 },
    { num: 10, label: 'Table 10 (Balcony)', cap: 6 },
    { num: 11, label: 'VIP Table 1', cap: 8 },
    { num: 12, label: 'VIP Table 2', cap: 8 },
  ];

  for (const t of tableConfigs) {
    await prisma.restaurantTable.create({
      data: {
        restaurantId: restaurant.id,
        tableNumber: t.num,
        label: t.label,
        capacity: t.cap,
        status: 'FREE',
      },
    });
  }

  // 11. Cameras (3)
  const cameraData = [
    { name: 'Main Dining Area', ipAddress: '192.168.1.10', streamUrl: 'rtsp://192.168.1.10:554/stream1', location: 'Main Hall' },
    { name: 'Kitchen', ipAddress: '192.168.1.11', streamUrl: 'rtsp://192.168.1.11:554/stream1', location: 'Kitchen' },
    { name: 'Cashier Area', ipAddress: '192.168.1.12', streamUrl: 'rtsp://192.168.1.12:554/stream1', location: 'Front Desk' },
  ];

  for (const c of cameraData) {
    await prisma.camera.create({
      data: {
        restaurantId: restaurant.id,
        name: c.name,
        ipAddress: c.ipAddress,
        streamUrl: c.streamUrl,
        location: c.location,
        port: 554,
        isActive: true,
      },
    });
  }

  // 12. FAQs (5)
  const faqData = [
    {
      question: 'What are your opening hours?',
      answer: 'We are open daily from 7:00 AM to 10:00 PM (closes at 9:00 PM on Sundays).',
      questionSw: 'Mnafungua saa ngapi?',
      answerSw: 'Tunafungua kila siku kutoka saa 1:00 asubuhi hadi saa 4:00 jioni (tunafunga saa 3:00 jioni Jumapili).',
      category: 'Hours',
    },
    {
      question: 'Do you offer vegetarian options?',
      answer: 'Yes! We have a variety of vegetarian and vegan dishes including our Vegetable Pilau and Kachumbari.',
      questionSw: 'Je, mna vyakula vya mboga tu?',
      answerSw: 'Ndiyo! Tuna vyakula mbalimbali vya mboga na vegan ikiwemo Pilau ya Mboga na Kachumbari.',
      category: 'Menu',
    },
    {
      question: 'Is parking available?',
      answer: 'Yes, we offer free parking for our guests with a secure parking lot adjacent to the restaurant.',
      questionSw: 'Je, kuna maegesho?',
      answerSw: 'Ndiyo, tunatoa maegesho ya bure kwa wageni wetu kwa maegesho salama karibu na mgahawa.',
      category: 'Amenities',
    },
    {
      question: 'Do you cater for large events?',
      answer: 'Absolutely! We cater for weddings, corporate events, and private parties. Contact us at events@bahari.co.ke for a quote.',
      questionSw: 'Je, mnahudumia hafla kubwa?',
      answerSw: 'Kabisa! Tunahudumia harusi, hafla za kampuni, na sherehe za kibinafsi. Wasiliana nasi kwa events@bahari.co.ke kwa bei.',
      category: 'Events',
    },
    {
      question: 'Can I place an order for delivery?',
      answer: 'Yes, you can order through our website or mobile menu for delivery within Mombasa area.',
      questionSw: 'Je, ninaweza kuagiza chakula kwa delivery?',
      answerSw: 'Ndiyo, unaweza kuagiza kupitia tovuti yetu au menu ya simu kwa delivery ndani ya Mombasa.',
      category: 'Orders',
    },
  ];

  for (const faq of faqData) {
    await prisma.restaurantFaq.create({
      data: {
        restaurantId: restaurant.id,
        question: faq.question,
        answer: faq.answer,
        questionSw: faq.questionSw,
        answerSw: faq.answerSw,
        category: faq.category,
        isActive: true,
      },
    });
  }

  // Summary
  const staffCount = await prisma.staff.count({ where: { restaurantId: restaurant.id } });
  const tableCount = await prisma.restaurantTable.count({ where: { restaurantId: restaurant.id } });
  const cameraCount = await prisma.camera.count({ where: { restaurantId: restaurant.id } });
  const menuItemCount = await prisma.menuItem.count({ where: { restaurantId: restaurant.id } });
  const faqCount = await prisma.restaurantFaq.count({ where: { restaurantId: restaurant.id } });

  console.log('Seed completed successfully!');
  console.log(`  - 3 subscription plans created`);
  console.log(`  - 1 super admin created`);
  console.log(`  - 1 owner created`);
  console.log(`  - 1 restaurant "Bahari Restaurant" created`);
  console.log(`  - ${await prisma.menuCategory.count()} menu categories created`);
  console.log(`  - ${menuItemCount} menu items created`);
  console.log(`  - ${staffCount} staff members created`);
  console.log(`  - ${tableCount} tables created`);
  console.log(`  - ${cameraCount} cameras created`);
  console.log(`  - ${faqCount} FAQs created`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
